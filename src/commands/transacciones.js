const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transacciones')
    .setDescription('Ver historial de transacciones de un usuario (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario para ver transacciones')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('limite')
        .setDescription('Cantidad de transacciones a mostrar (max 50)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const targetUser = interaction.options.getUser('usuario');
    const limit = interaction.options.getInteger('limite') || 10;
    
    const transactions = economy.getTransactions(targetUser.id, limit);
    
    let transactionsList = '';
    if (transactions.length === 0) {
      transactionsList = '*Sin transacciones registradas*';
    } else {
      for (const tx of transactions) {
        const symbol = tx.type === 'credit' ? '➕' : '➖';
        const amount = tx.type === 'credit' ? `+${tx.amount}` : `-${Math.abs(tx.amount)}`;
        const date = new Date(tx.created_at).toLocaleDateString('es-ES');
        transactionsList += `${symbol} ${config.CURRENCY_SYMBOL} ${amount} | ${tx.description} | ${date}\n`;
      }
    }
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 📜 Transacciones`,
      description: `**Historial de ${targetUser.username}**`,
      fields: [
        {
          name: `Últimas ${transactions.length} transacciones`,
          value: `\`\`\`\n${transactionsList}\`\`\``,
          inline: false
        }
      ],
      footer: `Total: ${transactions.length} transacciones | Información confidencial - Solo administradores`
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
