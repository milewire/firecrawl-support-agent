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
      { type: 3, name: "q", description: "Your question", required: true },   // STRING
      { type: 5, name: "private", description: "Reply only visible to you?" } // BOOLEAN
    ],
  },

  // Triage (classify text -> category/severity/needs-human)
  {
    name: "triage",
    description: "Classify text (category, severity, needs-human)",
    options: [
      { type: 3, name: "text", description: "Content to triage", required: true } // STRING
    ],
  },

  // Ticket (create GitHub issue)
  {
    name: "ticket",
    description: "Create a GitHub issue",
    options: [
      { type: 3, name: "title", description: "Issue title", required: true },         // STRING
      { type: 3, name: "description", description: "Describe the problem", required: true }, // STRING
      {
        type: 3, name: "severity", description: "Optional severity label",
        choices: [
          { name: "low", value: "low" },
          { name: "medium", value: "medium" },
          { name: "high", value: "high" },
          { name: "critical", value: "critical" }
        ]
      },
      { type: 5, name: "private", description: "Reply only visible to you?" } // BOOLEAN
    ],
  }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log("⏳ Refreshing application (/) commands...");
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Successfully reloaded application (/) commands.");
  } catch (err) {
    console.error("❌ Failed to refresh commands");
    console.error(err);
    process.exit(1);
  }
})();
