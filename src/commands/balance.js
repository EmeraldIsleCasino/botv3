const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const economy = require('../database/economy');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Ver tu balance o el de otro usuario (admin)')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('Usuario para ver balance (Admin)')
        .setRequired(false)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const targetUser = interaction.options.getUser('usuario');
    const isAdmin = interaction.memberPermissions.has(PermissionFlagsBits.Administrator);
    
    // Si pasa usuario pero no es admin, rechazar
    if (targetUser && !isAdmin) {
      const { errorEmbed } = require('../utils/embedBuilder');
      return interaction.editReply({ embeds: [errorEmbed('Solo los administradores pueden ver el balance de otros usuarios')] });
    }
    
    const userId = targetUser ? targetUser.id : interaction.user.id;
    const user = economy.getUser(userId);
    const discordUser = targetUser || interaction.user;
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - Balance`,
      description: `💰 **Balance de ${discordUser.username}**`,
      fields: [
        { name: `${config.CURRENCY_SYMBOL} Saldo Actual`, value: user.balance.toLocaleString(), inline: true },
        { name: '📈 Total Ganado', value: user.total_won.toLocaleString(), inline: true },
        { name: '📉 Total Perdido', value: user.total_lost.toLocaleString(), inline: true }
      ],
      footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
