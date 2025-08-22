// render-bot.mjs - Combined Discord bot + Web server for Render
import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { Octokit } from "@octokit/rest";
import express from 'express';
import bodyParser from 'body-parser';
import { setupEmailWebhook, processEmail } from './email_handler.js';
import { createIssue } from './github.mjs';

// ---- Safety nets ----
process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

// ---- No masking (pass-through) ----
function sanitize(s) {
  return String(s ?? ""); // intentionally no redaction
}

// ---- Discord client ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ---- OpenAI: /ask ----
async function aiAsk(text, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const firecrawlContext = `
You are a Firecrawl support expert. Firecrawl is a web scraping API that helps developers get LLM-ready data.

Key Firecrawl Information:
- API Endpoints: /scrape, /sitemap, /search
- Rate Limits: 1000 requests/hour
- Common Issues: rate limits, invalid URLs, API errors, billing
- Documentation: ${process.env.FIRECRAWL_DOCS_URL || 'https://docs.firecrawl.dev'}

Be concise and accurate in your response.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: `${firecrawlContext}\n\nUser: ${text}` }],
      max_tokens: 400,
    }),
    signal: controller.signal,
  });

  clearTimeout(t);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`);

  return data?.choices?.[0]?.message?.content || "I couldn't generate a response.";
}

// ---- Triage helpers (never return N/A) ----
function normalizeTriage(parsed, original) {
  const q = String(original || "");
  const lq = q.toLowerCase();

  const catEnum = ["api_error", "rate_limit", "billing", "integration", "question", "other"];
  const sevEnum = ["low", "medium", "high", "critical"];

  let summary = parsed?.summary && String(parsed.summary).trim();
  if (!summary) summary = q.slice(0, 140) || "User report";

  let category = (parsed?.category || "").toLowerCase();
  if (!catEnum.includes(category)) {
    if (/(error|exception|stack|500|fail|crash|timeout|broken|api|scrape)/.test(lq)) category = "api_error";
    else if (/(rate.?limit|429|too.?many|quota|limit)/.test(lq)) category = "rate_limit";
    else if (/(price|billing|invoice|charge|payment|refund|subscription)/.test(lq)) category = "billing";
    else if (/(integration|sdk|library|code|example|tutorial|how)/.test(lq)) category = "integration";
    else if (/(usage|docs|help|question)/.test(lq)) category = "question";
    else category = "other";
  }

  let severity = (parsed?.severity || "").toLowerCase();
  if (!sevEnum.includes(severity)) {
    if (/(data loss|security|critical|down|unavailable)/.test(lq)) severity = "critical";
    else if (/(500|blocker|cannot|can't|timeout|crash)/.test(lq)) severity = "high";
    else severity = "medium";
  }

  const needs_human =
    typeof parsed?.needs_human === "boolean" ? parsed.needs_human : severity !== "low";

  let suggested_reply = parsed?.suggested_reply && String(parsed.suggested_reply).trim();
  if (!suggested_reply) {
    suggested_reply =
      "Thanks for the report! Could you share steps to reproduce, the URL, expected vs actual behavior, and any timestamps or logs?";
  }

  return { summary, category, severity, needs_human, suggested_reply };
}

async function triage(text) {
  const prompt = `
You are a Firecrawl support expert. Analyze this issue and categorize it:

Issue: ${text}

Firecrawl is a web scraping API with these key features:
- Endpoints: /scrape, /sitemap, /search
- Rate limit: 1000 requests/hour
- Common issues: rate limits, invalid URLs, API errors, billing

Categorize this issue as one of:
- api_error: API/Scraping issues
- rate_limit: Rate limiting problems
- billing: Subscription/payment issues
- integration: SDK/API integration help
- question: General questions
- other: Doesn't fit other categories

Severity levels: low, medium, high, critical

Respond with JSON only:
{
  "category": "category_name",
  "severity": "severity_level",
  "summary": "Brief summary of the issue",
  "needs_human": true/false,
  "suggested_reply": "Suggested response to user"
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return normalizeTriage(result, text);
  } catch (error) {
    console.error("Error triaging:", error);
    return normalizeTriage({}, text);
  }
}

// ---- GitHub integration ----
const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function createIssue({ title, body, labels = [] }) {
  const response = await octokit.rest.issues.create({
    owner: process.env.GITHUB_OWNER,
    repo: process.env.GITHUB_REPO,
    title,
    body,
    labels,
  });
  return response.data.html_url;
}

// ---- Discord event handlers ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("🏓 Pong!");

  } else if (interaction.commandName === "help") {
    await interaction.reply("🤖 Commands: /ping, /help, /status, /doc, /ask, /triage, /ticket");

  } else if (interaction.commandName === "status") {
    await interaction.reply("✅ System is running smoothly!");

  } else if (interaction.commandName === "doc") {
    await interaction.reply("📄 Documentation: https://docs.firecrawl.dev");

  } else if (interaction.commandName === "ask") {
    const q = interaction.options.getString("q");
    const isPrivate = interaction.options.getBoolean("private") === true;

    await interaction.deferReply({ ephemeral: isPrivate });
    console.log(`[ASK] ${interaction.user.tag}: ${q}`);

    try {
      const answer = await aiAsk(q);
      await interaction.editReply(answer.slice(0, 1900));
    } catch (e) {
      const hint = !process.env.OPENAI_API_KEY ? " (missing OPENAI_API_KEY?)" : "";
      await interaction.editReply(`❌ AI error: ${e.message || e}${hint}`);
    }

  } else if (interaction.commandName === "triage") {
    const text = interaction.options.getString("text");
    await interaction.deferReply({ ephemeral: true });

    try {
      const t = await triage(text);
      const msg =
        `**Summary:** ${t.summary}\n` +
        `**Category:** ${t.category}\n` +
        `**Severity:** ${t.severity}\n` +
        `**Needs human:** ${t.needs_human ? "Yes" : "No"}\n\n` +
        `**Suggested reply:**\n${t.suggested_reply}`;
      await interaction.editReply(msg.slice(0, 1900));
    } catch (e) {
      await interaction.editReply(`❌ Triage failed: ${e.message || e}`);
    }

  } else if (interaction.commandName === "ticket") {
    const title = interaction.options.getString("title");
    const description = interaction.options.getString("description");
    const severityOpt = interaction.options.getString("severity");
    const isPrivate = interaction.options.getBoolean("private") === true;

    await interaction.deferReply({ ephemeral: isPrivate });
    console.log(`[TICKET] ${interaction.user.tag}: ${title}`);

    try {
      // Auto-triage description
      const t = await triage(description);

      // No masking: use the raw description
      const userDescription = sanitize(description); // pass-through

      // One canonical severity: user > AI > medium
      const finalSeverity = (severityOpt || t.severity || "medium").toLowerCase();

      // Namespaced labels (+ conflict flag only when they differ)
      const labels = Array.from(new Set([
        t.category ? `type/${t.category}` : "type/question",
        `severity/${finalSeverity}`,
        "ai-triaged",
        (severityOpt && t.severity && severityOpt.toLowerCase() !== t.severity.toLowerCase())
          ? "triage/conflict"
          : null
      ].filter(Boolean)));

      // Full issue body
      const body =
        `**Summary:** ${t.summary}\n\n` +
        `**Category:** ${t.category}\n` +
        `**Severity:** ${finalSeverity}` +
        ((severityOpt && t.severity && severityOpt.toLowerCase() !== t.severity.toLowerCase())
          ? ` (user: ${severityOpt}, ai: ${t.severity})`
          : ``) + `\n` +
        `**Needs human:** ${t.needs_human ? "Yes" : "No"}\n\n` +
        `**Reporter:** ${interaction.user.tag} (${interaction.user.id})\n\n` +
        `**User Description:**\n${userDescription}\n\n` +
        (t.suggested_reply ? `**Suggested reply:**\n${t.suggested_reply}\n` : "");

      const url = await createIssue({ title, body, labels });
      
      await interaction.editReply(`✅ Ticket created: ${url}`);
    } catch (e) {
      await interaction.editReply(`❌ Ticket failed: ${e.message || e}`);
    }

  } else if (interaction.commandName === "analytics") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply("📊 Analytics coming soon with Pinecone/Pylon integration!");
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});

// ---- Express Web Server ----
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Firecrawl Support Agent API',
    status: 'running',
    timestamp: new Date().toISOString(),
    bot: client.user?.tag || 'Starting...',
    uptime: process.uptime()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    bot: client.user?.tag || 'Starting...',
    uptime: process.uptime()
  });
});

// Email webhook
setupEmailWebhook(app);

// Manual email processing endpoint (for testing)
app.post('/process-email', async (req, res) => {
  try {
    const { from, subject, text, html } = req.body;
    
    if (!from || !subject || (!text && !html)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailData = { from, subject, text, html };
    const result = await processEmail(emailData);
    
    // Create GitHub issue
    const issue = await createIssue(result.issueData.title, result.issueData.body, result.issueData.labels);
    
    res.json({ 
      success: true, 
      ticketId: result.ticketData.id,
      issueNumber: issue.number,
      triage: result.triageResult
    });
  } catch (error) {
    console.error('Error processing email:', error);
    res.status(500).json({ error: 'Failed to process email' });
  }
});

// Start both Discord bot and web server
async function startServices() {
  try {
    // Start web server FIRST (so Render can see it's working)
    app.listen(PORT, () => {
      console.log(`🚀 Web server running on port ${PORT}`);
      console.log(`📧 Email webhook: http://localhost:${PORT}/email-webhook`);
      console.log(`🔧 Health check: http://localhost:${PORT}/health`);
    });
    
    // Then try to start Discord bot (but don't fail if it doesn't work)
    try {
      await client.login(process.env.DISCORD_BOT_TOKEN);
      console.log(`🤖 Discord bot: ${client.user?.tag || 'Starting...'}`);
    } catch (discordError) {
      console.error('Discord bot failed to start:', discordError.message);
      console.log('⚠️ Web server is still running for email/webhook functionality');
    }
  } catch (error) {
    console.error('Failed to start services:', error);
    process.exit(1);
  }
}

startServices();
