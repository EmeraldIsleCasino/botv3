const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveaways = require('../database/giveaways');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('borrarsorteo')
    .setDescription('Elimina el sorteo activo')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const giveaway = giveaways.getActiveGiveaway(interaction.channel.id);
    if (!giveaway) {
      return interaction.editReply({ embeds: [errorEmbed('No hay ningún sorteo activo en este canal.')] });
    }
    
    try {
      const message = await interaction.channel.messages.fetch(giveaway.message_id);
      await message.delete();
    } catch {}
    
    giveaways.deleteGiveaway(giveaway.id);
    
    await interaction.editReply({ embeds: [createEmbed({ description: '✅ Sorteo eliminado correctamente.' })] });
  }
};
