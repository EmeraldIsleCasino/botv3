const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const giveaways = require('../database/giveaways');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crearsorteo')
    .setDescription('Crea un nuevo sorteo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('premio')
        .setDescription('Premio del sorteo')
        .setRequired(true)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const existingGiveaway = giveaways.getActiveGiveaway(interaction.channel.id);
    if (existingGiveaway) {
      return interaction.editReply({ embeds: [errorEmbed('Ya existe un sorteo activo en este canal. Usa /cerrarsorteo o /borrarsorteo primero.')] });
    }
    
    const prize = interaction.options.getString('premio');
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🎉 SORTEO`,
      description: `**¡Participa para ganar!**\n\n🎁 **Premio:** ${prize}\n\n👥 **Participantes:** 0\n\n*Haz clic en el botón para participar*`,
      footer: 'Emerald Isle Casino ® - ¡Buena suerte a todos!'
    });
    
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_join')
          .setLabel('🎟️ Participar')
          .setStyle(ButtonStyle.Success)
      );
    
    const message = await interaction.channel.send({ embeds: [embed], components: [row] });
    giveaways.createGiveaway(interaction.channel.id, message.id, prize);
    
    await interaction.editReply({ embeds: [createEmbed({ description: '✅ Sorteo creado correctamente.' })] });
  }
};
