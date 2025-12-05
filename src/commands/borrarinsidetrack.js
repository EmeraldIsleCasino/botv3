const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const insidetrack = require('../database/insidetrack');
const economy = require('../database/economy');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('borrarinsidetrack')
    .setDescription('Elimina la carrera activa y devuelve las apuestas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const race = insidetrack.getActiveRace(interaction.channel.id);
    if (!race) {
      return interaction.editReply({ embeds: [errorEmbed('No hay ninguna carrera activa en este canal.')] });
    }
    
    const bets = insidetrack.getRaceBets(race.id);
    
    for (const bet of bets) {
      economy.addWinnings(bet.user_id, bet.amount);
    }
    
    try {
      const message = await interaction.channel.messages.fetch(race.message_id);
      await message.delete();
    } catch {}
    
    insidetrack.deleteRace(race.id);
    
    await interaction.editReply({ 
      embeds: [createEmbed({ 
        description: `✅ Carrera eliminada. Se han devuelto ${config.CURRENCY_SYMBOL} ${bets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} a ${bets.length} usuario(s).` 
      })] 
    });
  }
};
