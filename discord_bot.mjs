// discord_bot.mjs
import "dotenv/config";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { Octokit } from "@octokit/rest";

// ---- Safety nets (log silent crashes) ----
process.on("unhandledRejection", (r) => console.error("unhandledRejection:", r));
process.on("uncaughtException", (e) => console.error("uncaughtException:", e));

// ---- Sanitizer to avoid leaking sensitive bits in GitHub issues ----
function sanitize(s) {
  return String(s || "")
    // redact emails
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    // redact tokens in query strings like ?token=abc123
    .replace(/(?<=token=)[^&\s]+/gi, "[redacted-token]")
    // trim very long URLs so issues don’t explode
    .replace(/https?:\/\/\S+/g, (u) => (u.length > 80 ? u.slice(0, 80) + "…[truncated]" : u));
}

// ---- Discord client ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ---- OpenAI: /ask ----
async function aiAsk(text, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: `You are a helpful support agent. Be concise and accurate.\n\nUser: ${text}`,
      max_output_tokens: 400,
    }),
    signal: controller.signal,
  });

  clearTimeout(t);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(err);
  }

  return (
    data?.output?.[0]?.content?.[0]?.text ||
    data?.choices?.[0]?.message?.content ||
    "I couldn’t generate a response."
  );
}

// ---- Helpers: robust triage parsing + normalization (NO MORE N/A) ----
function normalizeTriage(parsed, original) {
  const q = String(original || "");
  const lq = q.toLowerCase();

  const catEnum = ["bug", "question", "billing", "feature_request", "usage", "other"];
  const sevEnum = ["low", "medium", "high", "critical"];

  let summary = parsed?.summary && String(parsed.summary).trim();
  if (!summary) summary = q.slice(0, 140) || "User report";

  let category = (parsed?.category || "").toLowerCase();
  if (!catEnum.includes(category)) {
    if (/(error|exception|stack|500|fail|bug|crash|timeout|broken)/.test(lq)) category = "bug";
    else if (/(price|billing|invoice|charge|payment|refund)/.test(lq)) category = "billing";
    else if (/(feature|request|roadmap|support new|add)/.test(lq)) category = "feature_request";
    else if (/(usage|example|tutorial|docs|how|help)/.test(lq)) category = "usage";
    else category = "question";
  }

  let severity = (parsed?.severity || "").toLowerCase();
  if (!sevEnum.includes(severity)) {
    if (/(data loss|security|critical|down|unavailable)/.test(lq)) severity = "critical";
    else if (/(500|blocker|cannot|can't|timeout|crash)/.test(lq)) severity = "high";
    else severity = "medium";
  }

  let needs_human =
    typeof parsed?.needs_human === "boolean" ? parsed.needs_human : severity !== "low";

  let suggested_reply =
    parsed?.suggested_reply && String(parsed.suggested_reply).trim();
  if (!suggested_reply) {
    suggested_reply =
      "Thanks for the report! Could you share steps to reproduce, the URL, expected vs actual behavior, and any timestamps or logs?";
  }

  return { summary, category, severity, needs_human, suggested_reply };
}

// ---- OpenAI: triage JSON (summary/category/severity/needs_human/suggested_reply) ----
async function triage(text) {
  const schema = {
    name: "SupportTriage",
    schema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        category: {
          type: "string",
          enum: ["bug", "question", "billing", "feature_request", "usage", "other"],
        },
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
        needs_human: { type: "boolean" },
        suggested_reply: { type: "string" },
      },
      required: ["summary", "category", "severity", "needs_human", "suggested_reply"],
      additionalProperties: false,
    },
    strict: true,
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
      max_output_tokens: 400,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(err);
  }

  // Handle both string JSON and object forms from Responses API
  const content = data?.output?.[0]?.content?.[0];
  let raw = content?.json ?? content?.text ?? null;

  let parsed = null;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    parsed = null;
  }

  const norm = normalizeTriage(parsed, text);
  console.log("[TRIAGE]", norm); // helpful debug
  return norm;
}

// ---- GitHub helper ----
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

// ---- Command Handlers ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("🏓 Pong!");

  } else if (interaction.commandName === "help") {
    await interaction.reply("🤖 Commands: /ping, /help, /status, /doc, /ask, /triage, /ticket");

  } else if (interaction.commandName === "status") {
    await interaction.reply("✅ System is running smoothly!");

  } else if (interaction.commandName === "doc") {
    await interaction.reply("📄 Documentation: https://your-docs-link-here.com");

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
      // Auto-triage description (always returns filled values)
      const t = await triage(description).catch(() => null);

      // --- sanitize description BEFORE sending to GitHub ---
      const safeDescription = sanitize(description);

      const labels = Array.from(
        new Set(
          [
            t?.category, // bug/question/feature_request/billing/usage/other
            t?.severity, // low/medium/high/critical
            severityOpt, // optional override
          ].filter(Boolean)
        )
      );

      const body =
        `**Summary:** ${t?.summary ?? "N/A"}\n\n` +
        `**Category:** ${t?.category ?? "N/A"}\n` +
        `**Severity:** ${t?.severity ?? (severityOpt || "N/A")}\n` +
        `**Needs human:** ${t?.needs_human ? "Yes" : "No"}\n\n` +
        `**Reporter:** ${interaction.user.tag} (${interaction.user.id})\n\n` +
        `**User Description:**\n${safeDescription}\n\n` +
        (t?.suggested_reply ? `**Suggested reply:**\n${t.suggested_reply}\n` : "");

      const url = await createIssue({ title, body, labels });
      await interaction.editReply(`✅ Ticket created: ${url}`);
    } catch (e) {
      await interaction.editReply(`❌ Ticket failed: ${e.message || e}`);
    }
  }
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);
