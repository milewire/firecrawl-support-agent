const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Ask Firecrawl support anything")
    .addStringOption(option =>
      option.setName("question")
        .setDescription("Your question about Firecrawl")
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const question = interaction.options.getString("question");
      const user = interaction.user;

      // Use the existing AI system to get a response
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
          subject: `Discord Question: ${question}`,
          text: question
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Create AI response embed
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🤖 Firecrawl AI Support")
          .setDescription(`**Question:** ${question}`)
          .addFields(
            { name: "Answer", value: getAIResponse(question, result), inline: false }
          )
          .addFields(
            { name: "Need More Help?", value: "Use `/ticket` to create a support ticket or `/docs` to search documentation", inline: false }
          )
          .setFooter({ text: `Asked by ${user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

      } else {
        throw new Error(`Failed to get AI response: ${response.status}`);
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ AI Response Error")
        .setDescription("There was an error getting an AI response. Please try again or use `/ticket` to create a support ticket.")
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};

function getAIResponse(question, result) {
  const lowerQuestion = question.toLowerCase();
  
  // Provide intelligent responses based on question type
  if (lowerQuestion.includes('how') && lowerQuestion.includes('use')) {
    return "**How to use Firecrawl:**\n1. Get your API key from the dashboard\n2. Make a POST request to `/scrape` with your URL\n3. Receive clean, structured data\n\n**Example:**\n```bash\ncurl -X POST https://api.firecrawl.dev/scrape \\\n  -H 'Authorization: Bearer YOUR_API_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"url\": \"https://example.com\"}'\n```";
  }
  
  if (lowerQuestion.includes('price') || lowerQuestion.includes('cost') || lowerQuestion.includes('billing')) {
    return "**Firecrawl Pricing:**\n• Free tier: 100 requests/month\n• Pro: $49/month for 10,000 requests\n• Enterprise: Custom pricing\n\nVisit https://firecrawl.dev/pricing for details.";
  }
  
  if (lowerQuestion.includes('error') || lowerQuestion.includes('problem') || lowerQuestion.includes('issue')) {
    return "**Common Solutions:**\n• Check your API key is valid\n• Verify the URL is accessible\n• Check rate limits (1000/hour)\n• Review error codes in docs\n\nIf the problem persists, use `/ticket` to create a support ticket.";
  }
  
  if (lowerQuestion.includes('api') || lowerQuestion.includes('endpoint')) {
    return "**Firecrawl API Endpoints:**\n• `/scrape` - Extract data from URLs\n• `/sitemap` - Get site structure\n• `/search` - Search across pages\n\n**Documentation:** https://docs.firecrawl.dev/api";
  }
  
  if (lowerQuestion.includes('limit') || lowerQuestion.includes('quota')) {
    return "**Rate Limits:**\n• 1000 requests per hour\n• Burst up to 100 requests/minute\n• Contact support for higher limits\n\n**Free Tier:** 100 requests/month";
  }
  
  // Default response
  return "I'm here to help with Firecrawl! For specific technical questions, try `/docs` to search documentation. For support issues, use `/ticket` to create a ticket. You can also visit https://docs.firecrawl.dev for comprehensive information.";
}
