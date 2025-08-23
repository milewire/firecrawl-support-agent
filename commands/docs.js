const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("docs")
    .setDescription("Search Firecrawl documentation")
    .addStringOption(option =>
      option.setName("query")
        .setDescription("What are you looking for? (e.g., 'API endpoints', 'rate limits', 'authentication')")
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const query = interaction.options.getString("query");
      const user = interaction.user;

      // Search documentation using existing email handler logic
      const response = await fetch('https://firecrawl-support-agent.onrender.com/process-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: {
            name: user.username,
            email: `${user.username}@discord.user`
          },
          subject: `Documentation Search: ${query}`,
          text: `Please provide documentation information about: ${query}`
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Create documentation response
        const embed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle("📚 Firecrawl Documentation")
          .setDescription(`**Search Query:** ${query}`)
          .addFields(
            { name: "Documentation", value: "https://docs.firecrawl.dev", inline: true },
            { name: "API Reference", value: "https://docs.firecrawl.dev/api", inline: true },
            { name: "Quick Start", value: "https://docs.firecrawl.dev/quickstart", inline: true }
          )
          .addFields(
            { name: "Key Information", value: getDocsInfo(query), inline: false }
          )
          .setFooter({ text: `Requested by ${user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Send additional help
        await interaction.followUp({
          content: `🔍 **Need more specific help?** Try using \`/ask\` for detailed questions about Firecrawl!`,
          ephemeral: true
        });

      } else {
        throw new Error(`Failed to search docs: ${response.status}`);
      }

    } catch (error) {
      console.error('Error searching docs:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Documentation Search Error")
        .setDescription("There was an error searching the documentation. Please try again or visit https://docs.firecrawl.dev directly.")
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

function getDocsInfo(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('api') || lowerQuery.includes('endpoint')) {
    return "**API Endpoints:**\n• `/scrape` - Extract data from URLs\n• `/sitemap` - Get site structure\n• `/search` - Search across pages\n\n**Rate Limits:** 1000 requests/hour";
  }
  
  if (lowerQuery.includes('rate limit') || lowerQuery.includes('quota')) {
    return "**Rate Limits:**\n• 1000 requests per hour\n• Burst up to 100 requests/minute\n• Contact support for higher limits";
  }
  
  if (lowerQuery.includes('auth') || lowerQuery.includes('token') || lowerQuery.includes('key')) {
    return "**Authentication:**\n• Bearer token in Authorization header\n• Get your API key from dashboard\n• Keep your key secure";
  }
  
  if (lowerQuery.includes('error') || lowerQuery.includes('troubleshoot')) {
    return "**Common Issues:**\n• 429: Rate limit exceeded\n• 500: Server error (contact support)\n• 400: Invalid request parameters";
  }
  
  return "Visit https://docs.firecrawl.dev for comprehensive documentation and examples.";
}
