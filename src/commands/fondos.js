const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fondos')
    .setDescription('Muestra los fondos y balances de todos los usuarios (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const users = economy.getAllUsers();
    const totalCirculation = economy.getTotalCirculation();
    const houseFunds = economy.getHouseFunds();
    
    let usersList = '';
    const topUsers = users.slice(0, 15);
    
    for (const user of topUsers) {
      try {
        const discordUser = await interaction.client.users.fetch(user.user_id);
        usersList += `${discordUser.tag}: ${config.CURRENCY_SYMBOL} ${user.balance.toLocaleString()}\n`;
      } catch {
        usersList += `Usuario ${user.user_id}: ${config.CURRENCY_SYMBOL} ${user.balance.toLocaleString()}\n`;
      }
    }
    
    if (users.length > 15) {
      usersList += `\n... y ${users.length - 15} usuarios más`;
    }
    
    if (!usersList) usersList = 'No hay usuarios registrados';
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - Fondos del Casino`,
      description: '📊 **Panel de Control de Fondos**',
      fields: [
        { name: '💵 Total en Circulación', value: `${config.CURRENCY_SYMBOL} ${totalCirculation.toLocaleString()}`, inline: true },
        { name: '📤 Total Entregado', value: `${config.CURRENCY_SYMBOL} ${houseFunds.total_out.toLocaleString()}`, inline: true },
        { name: '📥 Total Recuperado', value: `${config.CURRENCY_SYMBOL} ${houseFunds.total_in.toLocaleString()}`, inline: true },
        { name: '👥 Usuarios Registrados', value: users.length.toString(), inline: true },
        { name: '\n📋 Balances de Usuarios (Top 15)', value: `\`\`\`\n${usersList}\`\`\`` }
      ],
      footer: 'Información confidencial - Solo administradores'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
