const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
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
    .setName('mynfts')
    .setDescription('Ver tu colección de cartas NFT'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const userId = interaction.user.id;
    const cards = nftDb.getUserCards(userId);
    const equipped = nftDb.getUserEquippedCard(userId);
    
    let description = `**Tu colección de cartas NFT**\n\n`;
    
    if (equipped) {
      description += `🎯 **Carta equipada:** ${equipped.name}\n`;
      description += `   +${(equipped.bonus_value * 100).toFixed(0)}% ${equipped.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}\n\n`;
    }
    
    if (cards.length === 0) {
      description += `*No tienes cartas NFT aún*\n\n`;
      description += `**¿Cómo obtener cartas?**\n`;
      description += `• Juega minijuegos (drops aleatorios)\n`;
      description += `• Compra en la tienda (/nftshop)\n`;
    } else {
      description += `**Tus cartas (${cards.length}):**\n\n`;
      
      for (const card of cards.slice(0, 10)) {
        const isEquipped = equipped && equipped.card_id === card.card_id;
        const mark = isEquipped ? ' 🎯' : '';
        description += `${RARITY_EMOJIS[card.rarity]} **${card.name}**${mark} x${card.quantity}\n`;
        description += `   ${card.position} | ${card.club} | OVR ${card.overall}\n`;
      }
      
      if (cards.length > 10) {
        description += `\n*...y ${cards.length - 10} cartas más*`;
      }
    }

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - ⚽ MIS NFTs 🍀`,
      description,
      color: 0x27ae60,
      footer: 'Emerald Isle Casino ® - Colección de cartas'
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nft_shop_${userId}`)
        .setLabel('🛒 Tienda')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`nft_equip_menu_${userId}`)
        .setLabel('🎯 Equipar')
        .setStyle(ButtonStyle.Success)
        .setDisabled(cards.length === 0)
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }
};
