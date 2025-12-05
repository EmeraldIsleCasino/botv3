const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const insidetrack = require('../database/insidetrack');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('insidefondos')
    .setDescription('Muestra los fondos del sistema Inside Track (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const house = insidetrack.getInsideHouse();
    const balance = house.total_won - house.total_lost;
    const balanceColor = balance >= 0 ? '🟢' : '🔴';
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - Inside Track Fondos`,
      description: '🏇 **Panel de Control - Carreras de Caballos**',
      fields: [
        { name: '💰 Total Apostado', value: `${config.CURRENCY_SYMBOL} ${house.total_bets.toLocaleString()}`, inline: true },
        { name: '📈 Ganancias Casa', value: `${config.CURRENCY_SYMBOL} ${house.total_won.toLocaleString()}`, inline: true },
        { name: '📉 Pérdidas Casa', value: `${config.CURRENCY_SYMBOL} ${house.total_lost.toLocaleString()}`, inline: true },
        { name: `${balanceColor} Balance Final`, value: `${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`, inline: false }
      ],
      footer: 'Información confidencial - Solo administradores'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
