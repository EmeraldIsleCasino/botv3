const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const nftDb = require('./database');
const config = require('../../utils/config');

const RARITY_COLORS = {
  common: 0x9e9e9e,
  rare: 0x2196f3,
  epic: 0x9c27b0,
  legendary: 0xff9800,
  mythic: 0xe91e63
};

const RARITY_EMOJIS = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟠',
  mythic: '💎'
};

function createInventoryEmbed(userId, cards, page = 0) {
  const perPage = 8;
  const totalPages = Math.ceil(cards.length / perPage);
  const pageCards = cards.slice(page * perPage, (page + 1) * perPage);
  const equipped = nftDb.getUserEquippedCard(userId);
  
  let description = `**Tu colección de cartas NFT**\n\n`;
  
  if (pageCards.length === 0) {
    description += `*No tienes cartas NFT aún*\n`;
    description += `Juega minijuegos para obtener drops aleatorios.\n`;
  } else {
    for (const card of pageCards) {
      const isEquipped = equipped && equipped.card_id === card.card_id;
      const equippedMark = isEquipped ? ' 🎯' : '';
      description += `${RARITY_EMOJIS[card.rarity]} **${card.name}**${equippedMark}\n`;
      description += `   ${card.position} | ${card.club} | OVR ${card.overall}\n`;
      description += `   Cantidad: ${card.quantity} | Bonus: +${(card.bonus_value * 100).toFixed(0)}% ${card.bonus_type}\n\n`;
    }
  }
  
  if (totalPages > 1) {
    description += `\n📄 Página ${page + 1}/${totalPages}`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚽ MIS NFTs 🍀`,
    description,
    color: 0x27ae60,
    footer: 'Emerald Isle Casino ® - Colección de cartas'
  });
}

function createCardInfoEmbed(card) {
  let description = `${RARITY_EMOJIS[card.rarity]} **${card.rarity.toUpperCase()}**\n\n`;
  description += `⚽ **Posición:** ${card.position}\n`;
  description += `🏟️ **Club:** ${card.club}\n`;
  description += `🌍 **Nacionalidad:** ${card.nation}\n`;
  description += `⭐ **Overall:** ${card.overall}\n\n`;
  description += `**Bonus cuando está equipada:**\n`;
  description += `📈 +${(card.bonus_value * 100).toFixed(0)}% en ${card.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}\n\n`;
  description += `💰 **Precio en tienda:** ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()}\n`;
  description += `📊 **Total minteadas:** ${card.minted}`;

  return createEmbed({
    title: `⚽ ${card.name}`,
    description,
    color: RARITY_COLORS[card.rarity],
    footer: 'Emerald Isle Casino ® - Carta NFT'
  });
}

function createShopEmbed(cards, page = 0) {
  const perPage = 6;
  const totalPages = Math.ceil(cards.length / perPage);
  const pageCards = cards.slice(page * perPage, (page + 1) * perPage);
  
  let description = `**Tienda de cartas NFT**\n`;
  description += `Compra cartas para obtener bonos en tus ganancias.\n\n`;
  
  for (const card of pageCards) {
    description += `${RARITY_EMOJIS[card.rarity]} **${card.name}** - ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()}\n`;
    description += `   ${card.position} | ${card.club} | +${(card.bonus_value * 100).toFixed(0)}% ${card.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}\n\n`;
  }
  
  if (totalPages > 1) {
    description += `\n📄 Página ${page + 1}/${totalPages}`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🛒 TIENDA NFT 🍀`,
    description,
    color: 0xf39c12,
    footer: 'Emerald Isle Casino ® - Compra cartas'
  });
}

function createInventoryButtons(userId, page, totalPages) {
  const buttons = [];
  
  if (totalPages > 1) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`nft_inv_prev_${page}_${userId}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`nft_inv_next_${page}_${userId}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1)
    );
  }
  
  buttons.push(
    new ButtonBuilder()
      .setCustomId(`nft_shop_${userId}`)
      .setLabel('🛒 Tienda')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`nft_equip_menu_${userId}`)
      .setLabel('🎯 Equipar')
      .setStyle(ButtonStyle.Success)
  );
  
  return buttons.length > 0 ? [new ActionRowBuilder().addComponents(buttons)] : [];
}

function createShopButtons(userId, page, totalPages, cards) {
  const rows = [];
  
  if (totalPages > 1) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`nft_shop_prev_${page}_${userId}`)
        .setLabel('◀️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId(`nft_shop_next_${page}_${userId}`)
        .setLabel('▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`nft_inventory_${userId}`)
        .setLabel('📦 Inventario')
        .setStyle(ButtonStyle.Primary)
    ));
  }
  
  const perPage = 6;
  const pageCards = cards.slice(page * perPage, (page + 1) * perPage);
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
  
  return rows;
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId.startsWith('nft_inventory_') || customId === `nft_inv_${userId}`) {
    await interaction.deferUpdate();
    const cards = nftDb.getUserCards(userId);
    const embed = createInventoryEmbed(userId, cards, 0);
    const totalPages = Math.ceil(cards.length / 8);
    const buttons = createInventoryButtons(userId, 0, totalPages);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_inv_prev_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const page = Math.max(0, parseInt(parts[3]) - 1);
    const cards = nftDb.getUserCards(userId);
    const embed = createInventoryEmbed(userId, cards, page);
    const totalPages = Math.ceil(cards.length / 8);
    const buttons = createInventoryButtons(userId, page, totalPages);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_inv_next_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const currentPage = parseInt(parts[3]);
    const cards = nftDb.getUserCards(userId);
    const totalPages = Math.ceil(cards.length / 8);
    const page = Math.min(totalPages - 1, currentPage + 1);
    const embed = createInventoryEmbed(userId, cards, page);
    const buttons = createInventoryButtons(userId, page, totalPages);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_shop_') && !customId.includes('prev') && !customId.includes('next')) {
    await interaction.deferUpdate();
    const cards = nftDb.getShopCards();
    const embed = createShopEmbed(cards, 0);
    const totalPages = Math.ceil(cards.length / 6);
    const buttons = createShopButtons(userId, 0, totalPages, cards);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_shop_prev_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const page = Math.max(0, parseInt(parts[3]) - 1);
    const cards = nftDb.getShopCards();
    const embed = createShopEmbed(cards, page);
    const totalPages = Math.ceil(cards.length / 6);
    const buttons = createShopButtons(userId, page, totalPages, cards);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_shop_next_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const currentPage = parseInt(parts[3]);
    const cards = nftDb.getShopCards();
    const totalPages = Math.ceil(cards.length / 6);
    const page = Math.min(totalPages - 1, currentPage + 1);
    const embed = createShopEmbed(cards, page);
    const buttons = createShopButtons(userId, page, totalPages, cards);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('nft_buy_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const cardId = parseInt(parts[2]);
    
    const card = nftDb.getCardById(cardId);
    if (!card) {
      return interaction.followUp({
        embeds: [errorEmbed('Carta no encontrada.')],
        flags: 64
      });
    }
    
    const balance = economy.getBalance(userId);
    if (balance < card.price) {
      return interaction.followUp({
        embeds: [errorEmbed(`Necesitas ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()} para comprar esta carta.`)],
        flags: 64
      });
    }
    
    economy.removeBalance(userId, card.price, 'SYSTEM', 'Compra NFT: ' + card.name);
    nftDb.grantCard(userId, cardId, 'shop');
    
    const cards = nftDb.getShopCards();
    const embed = createShopEmbed(cards, 0);
    const totalPages = Math.ceil(cards.length / 6);
    const buttons = createShopButtons(userId, 0, totalPages, cards);
    
    await interaction.editReply({ embeds: [embed], components: buttons });
    
    return interaction.followUp({
      embeds: [successEmbed(`✅ ¡Compraste **${card.name}** (${card.rarity}) por ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()}!`)],
      flags: 64
    });
  }

  if (customId.startsWith('nft_equip_menu_')) {
    await interaction.deferUpdate();
    const cards = nftDb.getUserCards(userId);
    
    if (cards.length === 0) {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes cartas para equipar.')],
        flags: 64
      });
    }
    
    const equipped = nftDb.getUserEquippedCard(userId);
    
    let description = `**Selecciona una carta para equipar:**\n\n`;
    description += `La carta equipada te dará bonos en todos los minijuegos.\n\n`;
    
    if (equipped) {
      description += `🎯 **Actualmente equipada:** ${equipped.name}\n`;
      description += `   +${(equipped.bonus_value * 100).toFixed(0)}% ${equipped.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}\n\n`;
    }
    
    const selectOptions = cards.slice(0, 25).map(card => ({
      label: card.name,
      description: `${card.position} | +${(card.bonus_value * 100).toFixed(0)}% ${card.bonus_type}`,
      value: card.card_id.toString(),
      emoji: RARITY_EMOJIS[card.rarity]
    }));
    
    const select = new StringSelectMenuBuilder()
      .setCustomId(`nft_equip_select_${userId}`)
      .setPlaceholder('Selecciona una carta')
      .addOptions(selectOptions);
    
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🎯 EQUIPAR NFT 🍀`,
      description,
      color: 0x27ae60,
      footer: 'Emerald Isle Casino ® - Equipar carta'
    });
    
    const rows = [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`nft_unequip_${userId}`)
          .setLabel('❌ Desequipar')
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!equipped),
        new ButtonBuilder()
          .setCustomId(`nft_inventory_${userId}`)
          .setLabel('📦 Inventario')
          .setStyle(ButtonStyle.Secondary)
      )
    ];
    
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('nft_equip_select_')) {
    await interaction.deferUpdate();
    const cardId = parseInt(interaction.values[0]);
    
    const success = nftDb.equipCard(userId, cardId);
    if (!success) {
      return interaction.followUp({
        embeds: [errorEmbed('No se pudo equipar la carta.')],
        flags: 64
      });
    }
    
    const card = nftDb.getCardById(cardId);
    const cards = nftDb.getUserCards(userId);
    const embed = createInventoryEmbed(userId, cards, 0);
    const totalPages = Math.ceil(cards.length / 8);
    const buttons = createInventoryButtons(userId, 0, totalPages);
    
    await interaction.editReply({ embeds: [embed], components: buttons });
    
    return interaction.followUp({
      embeds: [successEmbed(`🎯 ¡Equipaste **${card.name}**! Ahora tienes +${(card.bonus_value * 100).toFixed(0)}% en ${card.bonus_type === 'winnings' ? 'ganancias' : 'suerte'}.`)],
      flags: 64
    });
  }

  if (customId.startsWith('nft_unequip_')) {
    await interaction.deferUpdate();
    nftDb.unequipCard(userId);
    
    const cards = nftDb.getUserCards(userId);
    const embed = createInventoryEmbed(userId, cards, 0);
    const totalPages = Math.ceil(cards.length / 8);
    const buttons = createInventoryButtons(userId, 0, totalPages);
    
    await interaction.editReply({ embeds: [embed], components: buttons });
    
    return interaction.followUp({
      embeds: [successEmbed('❌ Carta desequipada.')],
      flags: 64
    });
  }

  if (customId.startsWith('nft_info_')) {
    await interaction.deferReply({ flags: 64 });
    const cardId = parseInt(customId.split('_')[2]);
    const card = nftDb.getCardById(cardId);
    
    if (!card) {
      return interaction.editReply({
        embeds: [errorEmbed('Carta no encontrada.')]
      });
    }
    
    const embed = createCardInfoEmbed(card);
    return interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { handle };
