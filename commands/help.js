const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Lists all available commands"),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle("📖 Firecrawl Support Agent Help")
      .setDescription("Available commands for Firecrawl support:")
      .addFields(
        { name: "🎫 /ticket", value: "Create a new support ticket with priority levels", inline: true },
        { name: "📚 /docs", value: "Search Firecrawl documentation and API reference", inline: true },
        { name: "🤖 /ask", value: "Ask AI-powered questions about Firecrawl", inline: true },
        { name: "🏓 /ping", value: "Check if the support bot is online", inline: true },
        { name: "📧 Email Support", value: "Send emails to phillipsmith@milewireai.onmicrosoft.com", inline: true },
        { name: "⚡ Response Time", value: "We aim to respond within 2 hours", inline: true }
      )
      .addFields(
        { name: "🔗 Quick Links", value: "• [Documentation](https://docs.firecrawl.dev)\n• [API Reference](https://docs.firecrawl.dev/api)\n• [Pricing](https://firecrawl.dev/pricing)", inline: false }
      )
      .addFields(
        { name: "💡 Tips", value: "• Use `/docs` for quick information\n• Use `/ask` for detailed questions\n• Use `/ticket` for support issues\n• Include error codes and URLs for faster help", inline: false }
      )
      .setFooter({ text: "Firecrawl Support Agent - AI-Powered Support" });

    await interaction.reply({ embeds: [embed] });
  },
};
