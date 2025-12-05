const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeGames = new Map();
const setupState = new Map();

const WHEEL_SECTORS = [
  { multiplier: 0, color: '⬛', name: 'LOSE', weight: 3 },
  { multiplier: 1.2, color: '🟦', name: '1.2x', weight: 8 },
  { multiplier: 1.5, color: '🟦', name: '1.5x', weight: 7 },
  { multiplier: 0, color: '⬛', name: 'LOSE', weight: 3 },
  { multiplier: 2.0, color: '🟩', name: '2x', weight: 6 },
  { multiplier: 1.2, color: '🟦', name: '1.2x', weight: 8 },
  { multiplier: 0.5, color: '🟨', name: '0.5x', weight: 5 },
  { multiplier: 3.0, color: '🟩', name: '3x', weight: 4 },
  { multiplier: 0, color: '⬛', name: 'LOSE', weight: 3 },
  { multiplier: 1.5, color: '🟦', name: '1.5x', weight: 7 },
  { multiplier: 5.0, color: '🟧', name: '5x', weight: 3 },
  { multiplier: 1.2, color: '🟦', name: '1.2x', weight: 8 },
  { multiplier: 0, color: '⬛', name: 'LOSE', weight: 3 },
  { multiplier: 2.0, color: '🟩', name: '2x', weight: 6 },
  { multiplier: 10.0, color: '🟥', name: '10x', weight: 2 },
  { multiplier: 1.5, color: '🟦', name: '1.5x', weight: 7 },
  { multiplier: 0, color: '⬛', name: 'LOSE', weight: 3 },
  { multiplier: 3.0, color: '🟩', name: '3x', weight: 4 },
  { multiplier: 25.0, color: '🟪', name: '25x JACKPOT', weight: 1 },
  { multiplier: 1.2, color: '🟦', name: '1.2x', weight: 8 }
];

function spinWheel(userId) {
  const luckBonus = getNftLuckBonus(userId);
  const totalWeight = WHEEL_SECTORS.reduce((sum, s) => sum + s.weight, 0);
  
  let adjustedSectors = WHEEL_SECTORS.map(s => ({
    ...s,
    adjustedWeight: s.multiplier > 0 ? s.weight * (1 + luckBonus * 2) : s.weight * (1 - luckBonus)
  }));
  
  const adjustedTotal = adjustedSectors.reduce((sum, s) => sum + s.adjustedWeight, 0);
  let roll = Math.random() * adjustedTotal;
  
  for (let i = 0; i < adjustedSectors.length; i++) {
    roll -= adjustedSectors[i].adjustedWeight;
    if (roll <= 0) {
      return { index: i, sector: WHEEL_SECTORS[i] };
    }
  }
  
  return { index: 0, sector: WHEEL_SECTORS[0] };
}

function createWheelDisplay(highlightIndex = -1, spinning = false) {
  let display = '';
  
  if (spinning) {
    const spinEmojis = ['🎡', '🎰', '🌀', '💫'];
    display = spinEmojis[Math.floor(Math.random() * spinEmojis.length)].repeat(3);
    display += '\n*Girando...*';
  } else {
    const visibleRange = 3;
    for (let i = -visibleRange; i <= visibleRange; i++) {
      const idx = (highlightIndex + i + WHEEL_SECTORS.length) % WHEEL_SECTORS.length;
      const sector = WHEEL_SECTORS[idx];
      if (i === 0) {
        display += `▶️ **${sector.color} ${sector.name}** ◀️\n`;
      } else {
        display += `   ${sector.color} ${sector.name}\n`;
      }
    }
  }
  
  return display;
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Multiplicadores:**\n`;
  description += `🟪 25x JACKPOT (raro)\n`;
  description += `🟥 10x (muy raro)\n`;
  description += `🟧 5x (raro)\n`;
  description += `🟩 2-3x (poco común)\n`;
  description += `🟦 1.2-1.5x (común)\n`;
  description += `🟨 0.5x (recuperas mitad)\n`;
  description += `⬛ LOSE (pierdes todo)\n\n`;
  description += `*Ajusta tu apuesta y gira*`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🎡 WHEEL XTREME 🍀`,
    description,
    color: 0x9b59b6,
    footer: 'Emerald Isle Casino ® - ¡Gira la rueda!'
  });
}

function createSpinningEmbed(userId, bet, frame = 0) {
  const spinFrames = ['🎡 ⏳', '🌀 ⏳', '💫 ⏳', '🎰 ⏳'];
  
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🎡 WHEEL XTREME 🍀`,
    description: `${spinFrames[frame % spinFrames.length]}\n\n**¡GIRANDO LA RUEDA!**\n\n🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n*La rueda está girando...*`,
    color: 0xf1c40f,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createResultEmbed(userId, bet, result, payout) {
  const sector = result.sector;
  const isWin = sector.multiplier > 0;
  const isBigWin = sector.multiplier >= 5;
  const isJackpot = sector.multiplier >= 25;
  
  let wheelDisplay = createWheelDisplay(result.index);
  
  let description = `${wheelDisplay}\n\n`;
  description += `🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n`;
  description += `${sector.color} **Resultado:** ${sector.name}\n\n`;
  
  if (isJackpot) {
    description += `🎉🎉🎉 **¡¡¡JACKPOT!!!** 🎉🎉🎉\n`;
    description += `💰 **¡GANASTE ${config.CURRENCY_SYMBOL} ${payout.toLocaleString()}!**`;
  } else if (isBigWin) {
    description += `🎉 **¡GRAN VICTORIA!**\n`;
    description += `💰 **Ganaste:** ${config.CURRENCY_SYMBOL} ${payout.toLocaleString()}`;
  } else if (isWin) {
    description += `✅ **¡Ganaste!**\n`;
    description += `💰 **Ganancia:** ${config.CURRENCY_SYMBOL} ${payout.toLocaleString()}`;
  } else {
    description += `❌ **¡Perdiste!**\n`;
    description += `💸 Perdiste tu apuesta`;
  }

  let color = isJackpot ? 0x9b59b6 : isBigWin ? 0xf39c12 : isWin ? 0x2ecc71 : 0xe74c3c;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🎡 WHEEL XTREME 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Gira de nuevo!'
  });
}

function createSetupButtons(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wheel_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`wheel_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`wheel_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wheel_spin_${userId}`).setLabel('🎡 GIRAR').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`wheel_back_${userId}`).setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_wheel') {
    await interaction.deferReply({ flags: 64 });
    
    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('wheel_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('wheel_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('wheel_bet_max_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, 10000);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('wheel_spin_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    
    const balance = economy.getBalance(userId);
    if (balance < setup.bet) {
      return interaction.followUp({
        embeds: [errorEmbed(`Saldo insuficiente. Tienes ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`)],
        flags: 64
      });
    }

    if (!economy.deductForBet(userId, setup.bet)) {
      return interaction.followUp({
        embeds: [errorEmbed('No se pudo procesar la apuesta.')],
        flags: 64
      });
    }

    for (let i = 0; i < 3; i++) {
      const spinEmbed = createSpinningEmbed(userId, setup.bet, i);
      await interaction.editReply({ embeds: [spinEmbed], components: [] });
      await new Promise(resolve => setTimeout(resolve, 400));
    }

    const result = spinWheel(userId);
    let payout = Math.floor(setup.bet * result.sector.multiplier);
    
    if (payout > 0) {
      payout = applyNftBonus(userId, payout, true);
      economy.addWinnings(userId, payout);
      updateStats(userId, 'wheel_xtreme', setup.bet, payout, true);
    } else {
      updateStats(userId, 'wheel_xtreme', setup.bet, 0, false);
    }

    const drop = payout > 0 ? maybeDrop(userId, 'wheel_xtreme') : null;

    await new Promise(resolve => setTimeout(resolve, 500));

    const resultEmbed = createResultEmbed(userId, setup.bet, result, payout);
    const buttons = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`wheel_spin_${userId}`).setLabel('🎡 GIRAR DE NUEVO').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`wheel_back_${userId}`).setLabel('🔙 Menú').setStyle(ButtonStyle.Secondary)
      )
    ];

    await interaction.editReply({ embeds: [resultEmbed], components: buttons });

    if (drop) {
      await interaction.followUp({
        embeds: [successEmbed(`🎁 ¡Obtuviste una carta NFT! **${drop.name}** (${drop.rarity})`)],
        flags: 64
      });
    }
  }

  if (customId.startsWith('wheel_back_')) {
    await interaction.deferUpdate();
    
    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }
}

module.exports = { handle };
