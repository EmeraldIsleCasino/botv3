const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveaways = require('../database/giveaways');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cerrarsorteo')
    .setDescription('Cierra el sorteo activo y selecciona un ganador')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const giveaway = giveaways.getActiveGiveaway(interaction.channel.id);
    if (!giveaway) {
      return interaction.editReply({ embeds: [errorEmbed('No hay ningún sorteo activo en este canal.')] });
    }
    
    const participants = giveaways.getParticipants(giveaway.id);
    
    if (participants.length === 0) {
      giveaways.closeGiveaway(giveaway.id, null);
      
      const noWinnerEmbed = createEmbed({
        title: `${config.CASINO_NAME} - 🎉 SORTEO FINALIZADO`,
        description: `**¡El sorteo ha terminado!**\n\n🎁 **Premio:** ${giveaway.prize}\n\n😢 **No hubo participantes**`,
        color: 0xFF6B6B
      });
      
      try {
        const message = await interaction.channel.messages.fetch(giveaway.message_id);
        await message.edit({ embeds: [noWinnerEmbed], components: [] });
      } catch {}
      
      return interaction.editReply({ embeds: [createEmbed({ description: '✅ Sorteo cerrado. No hubo participantes.' })] });
    }
    
    const countdownEmbed = createEmbed({
      title: `${config.CASINO_NAME} - 🎉 SORTEO`,
      description: `**¡Cerrando sorteo!**\n\n🎁 **Premio:** ${giveaway.prize}\n\n⏳ **Seleccionando ganador en...**`,
      footer: '¡Mucha suerte a todos!'
    });
    
    try {
      const message = await interaction.channel.messages.fetch(giveaway.message_id);
      await message.edit({ embeds: [countdownEmbed], components: [] });
      
      await interaction.editReply({ embeds: [createEmbed({ description: '⏳ Iniciando cuenta regresiva...' })] });
      
      for (let i = 10; i > 0; i--) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const updateEmbed = createEmbed({
          title: `${config.CASINO_NAME} - 🎉 SORTEO`,
          description: `**¡Cerrando sorteo!**\n\n🎁 **Premio:** ${giveaway.prize}\n\n⏳ **${i}...**`,
          footer: '¡Mucha suerte a todos!'
        });
        await message.edit({ embeds: [updateEmbed] });
      }
      
      const winnerIndex = Math.floor(Math.random() * participants.length);
      const winnerId = participants[winnerIndex].user_id;
      
      giveaways.closeGiveaway(giveaway.id, winnerId);
      
      const winnerEmbed = createEmbed({
        title: `${config.CASINO_NAME} - 🎉 ¡TENEMOS UN GANADOR!`,
        description: `**¡Felicidades!**\n\n🎁 **Premio:** ${giveaway.prize}\n\n🏆 **Ganador:** <@${winnerId}>\n\n👥 **Total de participantes:** ${participants.length}`,
        color: 0xFFD700
      });
      
      await message.edit({ embeds: [winnerEmbed] });
      await interaction.channel.send(`🎉 ¡Felicidades <@${winnerId}>! Has ganado **${giveaway.prize}**`);
      
    } catch (error) {
      console.error('Error closing giveaway:', error);
      return interaction.editReply({ embeds: [errorEmbed('Error al cerrar el sorteo.')] });
    }
  }
};
