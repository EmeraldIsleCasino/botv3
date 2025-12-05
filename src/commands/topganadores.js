const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveaways = require('../database/giveaways');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('topganadores')
    .setDescription('Muestra el top de ganadores de sorteos (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const topWinners = giveaways.getTopWinners(10);
    
    let winnersList = '';
    let position = 1;
    
    for (const winner of topWinners) {
      try {
        const user = await interaction.client.users.fetch(winner.user_id);
        const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
        winnersList += `${medal} ${user.tag} - **${winner.wins}** victorias\n`;
      } catch {
        winnersList += `${position}. Usuario ${winner.user_id} - **${winner.wins}** victorias\n`;
      }
      position++;
    }
    
    if (!winnersList) winnersList = 'No hay ganadores registrados aún.';
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🏆 Top Ganadores de Sorteos`,
      description: winnersList,
      footer: 'Información confidencial - Solo administradores'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
