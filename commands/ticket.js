const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Create a new support ticket")
    .addStringOption(option =>
      option.setName("subject")
        .setDescription("Brief description of the issue")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("description")
        .setDescription("Detailed description of the problem")
        .setRequired(true))
    .addStringOption(option =>
      option.setName("priority")
        .setDescription("Issue priority level")
        .setRequired(false)
        .addChoices(
          { name: "Low", value: "low" },
          { name: "Medium", value: "medium" },
          { name: "High", value: "high" },
          { name: "Critical", value: "critical" }
        )),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const subject = interaction.options.getString("subject");
      const description = interaction.options.getString("description");
      const priority = interaction.options.getString("priority") || "medium";
      
      const user = interaction.user;
      const fullDescription = `**User:** ${user.username} (${user.id})
**Channel:** ${interaction.channel.name}
**Priority:** ${priority}

**Issue:** ${description}`;

      // Create ticket data
      const ticketData = {
        user: user.username,
        source: "discord",
        message: description,
        subject: subject,
        email: `${user.username}@discord.user`,
        priority: priority
      };

      // Process the ticket using existing email handler logic
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
          subject: subject,
          text: description
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle("🎫 Support Ticket Created")
          .setDescription(`**Subject:** ${subject}`)
          .addFields(
            { name: "Priority", value: priority.toUpperCase(), inline: true },
            { name: "Status", value: "Open", inline: true },
            { name: "GitHub Issue", value: result.issueUrl || "Processing...", inline: false },
            { name: "Category", value: result.triage?.category || "Processing...", inline: true },
            { name: "Severity", value: result.triage?.severity || "Processing...", inline: true }
          )
          .setFooter({ text: `Ticket created by ${user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        
        // Send confirmation to user
        await interaction.followUp({
          content: `✅ Your support ticket has been created! We'll respond within 2 hours. Check the GitHub issue for updates: ${result.issueUrl}`,
          ephemeral: true
        });

      } else {
        throw new Error(`Failed to create ticket: ${response.status}`);
      }

    } catch (error) {
      console.error('Error creating ticket:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle("❌ Error Creating Ticket")
        .setDescription("There was an error creating your support ticket. Please try again or contact support directly.")
        .setTimestamp();

      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
