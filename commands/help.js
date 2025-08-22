const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lists all available commands"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📖 Firecrawl Support Agent Help")
      .setDescription("Available commands:")
      .addFields(
        { name: "/ping", value: "Check if bot is alive" },
        { name: "/ticket", value: "Open a new support ticket" },
        { name: "/docs <topic>", value: "Lookup documentation" }
      )
      .setFooter({ text: "Firecrawl Support Agent" });

    await interaction.reply({ embeds: [embed] });
  },
};
