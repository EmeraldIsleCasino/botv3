const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { successEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quitardinero')
    .setDescription('Quita saldo a un usuario')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario al que quitar saldo')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad a quitar')
        .setRequired(true)
        .setMinValue(1)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const user = interaction.options.getUser('usuario');
    const amount = interaction.options.getInteger('cantidad');
    
    const { newBalance, removed } = economy.removeBalance(user.id, amount, interaction.user.id, 'Retiro por administrador');
    
    const embed = successEmbed(
      `Se han quitado **${config.CURRENCY_SYMBOL} ${removed.toLocaleString()}** de ${user.toString()}`,
      [
        { name: 'Nuevo Balance', value: `${config.CURRENCY_SYMBOL} ${newBalance.toLocaleString()}`, inline: true },
        { name: 'Administrador', value: interaction.user.toString(), inline: true }
      ]
    );
    
    await interaction.editReply({ embeds: [embed] });
  }
};
