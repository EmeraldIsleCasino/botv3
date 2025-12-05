const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const SlotsManager = require('../systems/slots/slotsManager');
const economy = require('../database/economy');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slots')
    .setDescription('Abre el menú de tragamonedas'),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 0 });

    const games = SlotsManager.getGameList();
    
    const description = games.map((game, idx) => `**${idx + 1}.** ${game.name}`).join('\n');
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🎰 SLOTS`,
      description: `\n📌 **Elige un juego:**\n\n${description}\n\n💎 Mínimo: $100 | Máximo: $5000`,
      color: 0x00FF7F,
      footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
    });

    const buttons = games.map((game, idx) => 
      new ButtonBuilder()
        .setCustomId(`slots_game_${game.key}`)
        .setLabel(game.name.split(' ')[1])
        .setStyle(ButtonStyle.Primary)
        .setEmoji(game.name.split(' ')[0])
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
      rows.push(row);
    }

    await interaction.editReply({ embeds: [embed], components: rows });
  }
};
