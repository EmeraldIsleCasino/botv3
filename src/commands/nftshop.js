const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const nftDb = require('../nfts/system/database');
const config = require('../utils/config');

const RARITY_EMOJIS = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟠',
  mythic: '💎'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nftshop')
    .setDescription('Tienda de cartas NFT de jugadores de fútbol'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const userId = interaction.user.id;
    const cards = nftDb.getShopCards();
    
    let description = `**Tienda de cartas NFT**\n`;
    description += `Compra cartas para obtener bonos en tus ganancias.\n\n`;
    
    const pageCards = cards.slice(0, 6);
    
    for (const card of pageCards) {
      description += `${RARITY_EMOJIS[card.rarity]} **${card.name}** - ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()}\n`;
      description += `   ${card.position} | ${card.club} | +${(card.bonus_value * 100).toFixed(0)}% ${card.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}\n\n`;
    }
    
    const totalPages = Math.ceil(cards.length / 6);
    if (totalPages > 1) {
      description += `\n📄 Página 1/${totalPages}`;
    }

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🛒 TIENDA NFT 🍀`,
      description,
      color: 0xf39c12,
      footer: 'Emerald Isle Casino ® - Compra cartas'
    });

    const rows = [];
    
    if (totalPages > 1) {
      rows.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`nft_shop_prev_0_${userId}`)
          .setLabel('◀️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`nft_shop_next_0_${userId}`)
          .setLabel('▶️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`nft_inventory_${userId}`)
          .setLabel('📦 Inventario')
          .setStyle(ButtonStyle.Primary)
      ));
    }
    
    const buyButtons = pageCards.slice(0, 5).map(card => 
      new ButtonBuilder()
        .setCustomId(`nft_buy_${card.id}_${userId}`)
        .setLabel(`${card.name.split(' ')[0]}`)
        .setEmoji(RARITY_EMOJIS[card.rarity])
        .setStyle(ButtonStyle.Success)
    );
    
    if (buyButtons.length > 0) {
      rows.push(new ActionRowBuilder().addComponents(buyButtons));
    }

    await interaction.editReply({ embeds: [embed], components: rows });
  }
};
