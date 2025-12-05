const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const economy = require('../database/economy');
const bj = require('../systems/blackjack/simple');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Juega Blackjack'),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 0 });
    
    const uid = interaction.user.id;
    bj.create(uid);
    const balance = economy.getBalance(uid);
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🂠 BLACKJACK`,
      description: `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance}\n💎 **Apuesta:** ${config.CURRENCY_SYMBOL} 0\n\n*Ajusta tu apuesta*`,
      color: 0xFFD700
    });

    const btns = [
      new ButtonBuilder().setCustomId(`bj_modal_${uid}`).setLabel('🎰 JUGAR BLACKJACK').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`bj_x_${uid}`).setLabel('❌ CANCELAR').setStyle(ButtonStyle.Danger)
    ];

    await interaction.editReply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btns)] });
  }
};
