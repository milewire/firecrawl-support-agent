// deploy-commands.mjs
import "dotenv/config";
import { REST, Routes } from "discord.js";

const commands = [
  { name: "ping", description: "Replies with Pong!" },
  { name: "help", description: "Lists available commands" },
  { name: "status", description: "Shows system status" },
  { name: "doc", description: "Get a documentation link" },

  // Ask (AI Q&A)
  {
    name: "ask",
    description: "Ask the AI a support question",
    options: [
      { type: 3, name: "q", description: "Your question", required: true },
      { type: 5, name: "private", description: "Reply only visible to you?" }
    ],
  },

  // Triage (classify text)
  {
    name: "triage",
    description: "Classify text (category, severity, needs-human)",
    options: [
      { type: 3, name: "text", description: "Content to triage", required: true }
    ],
  },

  // Ticket (create GitHub issue with full details)
  {
    name: "ticket",
    description: "Create a GitHub issue",
    options: [
      { type: 3, name: "title", description: "Issue title", required: true },
      { type: 3, name: "description", description: "Describe the problem", required: true },
      {
        type: 3, name: "severity", description: "Optional severity",
        choices: [
          { name: "low", value: "low" },
          { name: "medium", value: "medium" },
          { name: "high", value: "high" },
          { name: "critical", value: "critical" }
        ]
      },
      { type: 5, name: "private", description: "Reply only visible to you?" }
    ],
  },

  // Analytics (placeholder for Pinecone/Pylon)
  {
    name: "analytics",
    description: "Show support analytics (coming soon)",
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log("⏳ Refreshing application (/) commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: commands }
    );
    console.log("✅ Successfully reloaded application (/) commands.");
  } catch (err) {
    console.error("❌ Failed to refresh commands");
    console.error(err);
    process.exit(1);
  }
})();
