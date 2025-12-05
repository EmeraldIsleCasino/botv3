const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { errorEmbed, successEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reseteconomia')
    .setDescription('Resetear TODA la economía del servidor (⚠️ EXTREMO CUIDADO)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    try {
      const db = require('../database').economyDb;
      
      // Limpiar usuarios pero mantener IDs
      db.prepare('UPDATE users SET balance = 0, total_won = 0, total_lost = 0').run();
      
      // Limpiar transacciones
      db.prepare('DELETE FROM transactions').run();
      
      // Resetear fondos de la casa
      db.prepare('UPDATE house_funds SET total_in = 0, total_out = 0 WHERE id = 1').run();
      
      const embed = successEmbed(
        '✅ Economía del servidor ha sido completamente reseteada',
        [
          { name: '💰 Balances', value: 'Todos a 0', inline: true },
          { name: '📜 Transacciones', value: 'Eliminadas', inline: true },
          { name: '🏦 Fondos Casa', value: 'Reseteados', inline: true }
        ]
      );
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error reseteando economía:', error);
      await interaction.editReply({ 
        embeds: [errorEmbed('❌ Error al resetear la economía')] 
      });
    }
  }
};
