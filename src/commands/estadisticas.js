const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estadisticas')
    .setDescription('Ver estadísticas generales del casino (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const users = economy.getAllUsers();
    const totalCirculation = economy.getTotalCirculation();
    const houseFunds = economy.getHouseFunds();
    
    // Calcular estadísticas
    const activeUsers = users.filter(u => u.balance > 0).length;
    const totalUsers = users.length;
    const richestUser = users[0];
    const avgBalance = totalUsers > 0 ? Math.floor(totalCirculation / totalUsers) : 0;
    
    let richestName = 'N/A';
    if (richestUser) {
      try {
        const discordUser = await interaction.client.users.fetch(richestUser.user_id);
        richestName = discordUser.username;
      } catch {
        richestName = `ID: ${richestUser.user_id}`;
      }
    }
    
    const netProfit = houseFunds.total_in - houseFunds.total_out;
    const profitStatus = netProfit >= 0 ? '📈' : '📉';
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 📊 Estadísticas del Casino`,
      description: '**Panel de Análisis Económico General**',
      fields: [
        { name: '👥 Usuarios Registrados', value: totalUsers.toString(), inline: true },
        { name: '💰 Usuarios Activos', value: activeUsers.toString(), inline: true },
        { name: '💵 Saldo Promedio', value: `${config.CURRENCY_SYMBOL} ${avgBalance.toLocaleString()}`, inline: true },
        { name: '💸 Total en Circulación', value: `${config.CURRENCY_SYMBOL} ${totalCirculation.toLocaleString()}`, inline: true },
        { name: '📤 Total Distribuido', value: `${config.CURRENCY_SYMBOL} ${houseFunds.total_out.toLocaleString()}`, inline: true },
        { name: '📥 Total Recuperado', value: `${config.CURRENCY_SYMBOL} ${houseFunds.total_in.toLocaleString()}`, inline: true },
        { name: `${profitStatus} Ganancia Neta`, value: `${config.CURRENCY_SYMBOL} ${Math.abs(netProfit).toLocaleString()}`, inline: true },
        { name: '🏆 Jugador más Rico', value: `${richestName}: ${config.CURRENCY_SYMBOL} ${richestUser ? richestUser.balance.toLocaleString() : '0'}`, inline: false }
      ],
      footer: 'Información confidencial - Solo administradores'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
