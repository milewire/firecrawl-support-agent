// discord_bot.mjs
import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { Octokit } from "@octokit/rest";
// Analytics removed - will be replaced with Pinecone/Pylon integration

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

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: `${firecrawlContext}\n\nUser: ${text}`,
      max_output_tokens: 400,
    }),
    signal: controller.signal,
  });

  clearTimeout(t);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`);

  return (
    data?.output?.[0]?.content?.[0]?.text ||
    data?.choices?.[0]?.message?.content ||
    "I couldn’t generate a response."
  );
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
  try {
    const schema = {
      name: "SupportTriage",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          category: { type: "string", enum: ["bug", "question", "billing", "feature_request", "usage", "other"] },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
          needs_human: { type: "boolean" },
          suggested_reply: { type: "string" }
        },
        required: ["summary", "category", "severity", "needs_human", "suggested_reply"],
        additionalProperties: false
      },
      strict: true
    };

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `Classify the following support text. Be concise.\n\nText:\n${text}`,
        response_format: { type: "json_schema", json_schema: schema },
        max_output_tokens: 400
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error?.message || `${res.status} ${res.statusText}`);

    const content = data?.output?.[0]?.content?.[0];
    const raw = content?.json ?? content?.text ?? null;

    let parsed = null;
    try { parsed = typeof raw === "string" ? JSON.parse(raw) : raw; } catch { parsed = null; }

    const norm = normalizeTriage(parsed, text);
    console.log("[TRIAGE]", norm);
    return norm;
  } catch {
    const norm = normalizeTriage(null, text);
    console.log("[TRIAGE:fallback]", norm);
    return norm;
  }
}

// ---- GitHub ----
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
async function createIssue({ title, body, labels = [] }) {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!owner || !repo || !process.env.GITHUB_TOKEN) {
    throw new Error("Missing GITHUB_OWNER/GITHUB_REPO/GITHUB_TOKEN");
  }
  const { data } = await octokit.issues.create({ owner, repo, title, body, labels });
  return data.html_url;
}

// ---- Commands ----
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
      
      // Analytics tracking will be added with Pinecone/Pylon integration
      
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

// Simple web server for Render
import express from 'express';
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ 
    message: 'Firecrawl Support Agent API',
    status: 'running',
    bot: client.user?.tag || 'Starting...',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    bot: client.user?.tag || 'Starting...',
    timestamp: new Date().toISOString()
  });
});

// Start web server
app.listen(PORT, () => {
  console.log(`🚀 Web server running on port ${PORT}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
