const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeGames = new Map();
const setupState = new Map();

const EVENTS = [
  { name: 'Nitro Boost', emoji: '🚀', multiplier: 1.5, chance: 0.08 },
  { name: 'Oil Slick', emoji: '🛢️', multiplier: 0.5, chance: 0.10 },
  { name: 'Turbo', emoji: '⚡', multiplier: 2.0, chance: 0.05 },
  { name: 'Tire Blowout', emoji: '💥', multiplier: 0.3, chance: 0.12 },
  { name: 'Perfect Line', emoji: '🎯', multiplier: 1.3, chance: 0.15 },
  { name: 'Wind Resistance', emoji: '💨', multiplier: 0.8, chance: 0.18 }
];

function generateCrashPoint() {
  const e = Math.random();
  return Math.max(1.0, (100 * e) / (100 * e - 1 + 100));
}

function createGame(userId, bet) {
  const crashPoint = generateCrashPoint();
  const game = {
    bet,
    crashPoint: Math.min(crashPoint, 100),
    currentMultiplier: 1.0,
    state: 'running',
    events: [],
    position: 0,
    cashedOut: false,
    cashoutMultiplier: null,
    createdAt: Date.now()
  };
  activeGames.set(userId, game);
  return game;
}

function getGame(userId) {
  return activeGames.get(userId);
}

function endGame(userId) {
  activeGames.delete(userId);
}

function createRaceTrack(position, maxPosition = 50, crashed = false) {
  const trackLength = 20;
  const carPosition = Math.min(Math.floor((position / maxPosition) * trackLength), trackLength - 1);
  
  let track = '';
  for (let i = 0; i < trackLength; i++) {
    if (i === carPosition) {
      track += crashed ? '💥' : '🏎️';
    } else if (i < carPosition) {
      track += '─';
    } else {
      track += '░';
    }
  }
  track += '🏁';
  
  return track;
}

function createGameEmbed(userId, game, status = 'running') {
  const balance = economy.getBalance(userId);
  const potentialWin = Math.floor(game.bet * game.currentMultiplier);
  
  let description = `🏎️ **NAHCAR CRASH** 🏎️\n\n`;
  description += `${createRaceTrack(game.position, 50, status === 'crashed')}\n\n`;
  description += `💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${game.bet.toLocaleString()}\n`;
  description += `📈 **Multiplicador:** ${game.currentMultiplier.toFixed(2)}x\n`;
  description += `💵 **Ganancia actual:** ${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}\n\n`;
  
  if (game.events.length > 0) {
    description += `**Eventos:**\n`;
    for (const event of game.events.slice(-3)) {
      description += `${event.emoji} ${event.name}\n`;
    }
    description += `\n`;
  }
  
  let color = 0x50c878;
  let title = 'Corriendo...';

  if (status === 'cashed_out') {
    color = 0x00ff00;
    title = '¡COBRADO!';
    const winnings = Math.floor(game.bet * game.cashoutMultiplier);
    description += `\n🎉 **¡Cobraste a ${game.cashoutMultiplier.toFixed(2)}x!**\n`;
    description += `💵 **Ganaste:** ${config.CURRENCY_SYMBOL} ${winnings.toLocaleString()}`;
  } else if (status === 'crashed') {
    color = 0xff0000;
    title = '¡CRASH!';
    description += `\n💥 **¡Crash a ${game.crashPoint.toFixed(2)}x!**\n`;
    description += `❌ **Perdiste:** ${config.CURRENCY_SYMBOL} ${game.bet.toLocaleString()}`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🏎️ ${title} 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Cobra antes del crash!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🏎️ NAHCAR CRASH 🍀`,
    description: `¡Observa cómo sube el multiplicador y cobra antes de que crashee!\n\n💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n**Eventos aleatorios:**\n🚀 Nitro Boost - Aumenta velocidad\n⚡ Turbo - Gran boost\n🛢️ Oil Slick - Reduce velocidad\n💥 Tire Blowout - Peligro de crash\n\n*Ajusta tu apuesta y comienza*`,
    color: 0x50c878,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createSetupButtons(userId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`crash_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`crash_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_start_${userId}`).setLabel('🏎️ ARRANCAR').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`crash_back_${userId}`).setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function runGameLoop(interaction, userId) {
  const game = getGame(userId);
  if (!game || game.state !== 'running') return;

  const updateInterval = 800;
  const multiplierIncrement = 0.08;

  while (game.state === 'running') {
    await new Promise(resolve => setTimeout(resolve, updateInterval));
    
    const currentGame = getGame(userId);
    if (!currentGame || currentGame.state !== 'running') break;

    currentGame.currentMultiplier += multiplierIncrement;
    currentGame.position += 2;

    for (const event of EVENTS) {
      if (Math.random() < event.chance * 0.1) {
        currentGame.events.push(event);
        currentGame.currentMultiplier *= event.multiplier;
        if (currentGame.currentMultiplier < 1) currentGame.currentMultiplier = 1;
        break;
      }
    }

    if (currentGame.currentMultiplier >= currentGame.crashPoint) {
      currentGame.state = 'crashed';
      updateStats(userId, 'nahcar_crash', currentGame.bet, 0, false);
      
      const embed = createGameEmbed(userId, currentGame, 'crashed');
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`crash_newgame_${userId}`).setLabel('🔄 Nuevo Juego').setStyle(ButtonStyle.Primary)
      );
      
      try {
        await interaction.editReply({ embeds: [embed], components: [buttons] });
      } catch (e) {}
      
      endGame(userId);
      return;
    }

    const embed = createGameEmbed(userId, currentGame);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_cashout_${userId}`).setLabel(`💰 COBRAR ${currentGame.currentMultiplier.toFixed(2)}x`).setStyle(ButtonStyle.Success)
    );

    try {
      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (e) {
      break;
    }
  }
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_crash') {
    await interaction.deferReply({ flags: 64 });
    
    const existingGame = getGame(userId);
    if (existingGame && existingGame.state === 'running') {
      const embed = createGameEmbed(userId, existingGame);
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`crash_cashout_${userId}`).setLabel(`💰 COBRAR ${existingGame.currentMultiplier.toFixed(2)}x`).setStyle(ButtonStyle.Success)
      );
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }

    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('crash_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('crash_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('crash_bet_max_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, 10000);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('crash_start_')) {
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

    const game = createGame(userId, setup.bet);
    setupState.delete(userId);

    const embed = createGameEmbed(userId, game);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_cashout_${userId}`).setLabel(`💰 COBRAR ${game.currentMultiplier.toFixed(2)}x`).setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    
    runGameLoop(interaction, userId);
  }

  if (customId.startsWith('crash_cashout_')) {
    await interaction.deferUpdate();
    
    const game = getGame(userId);
    if (!game || game.state !== 'running') {
      return;
    }

    game.state = 'cashed_out';
    game.cashoutMultiplier = game.currentMultiplier;
    
    let payout = Math.floor(game.bet * game.cashoutMultiplier);
    payout = applyNftBonus(userId, payout, true);
    economy.addWinnings(userId, payout);
    updateStats(userId, 'nahcar_crash', game.bet, payout, true);
    
    const drop = maybeDrop(userId, 'nahcar_crash');

    const embed = createGameEmbed(userId, game, 'cashed_out');
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`crash_newgame_${userId}`).setLabel('🔄 Nuevo Juego').setStyle(ButtonStyle.Primary)
    );

    endGame(userId);

    await interaction.editReply({ embeds: [embed], components: [buttons] });

    if (drop) {
      await interaction.followUp({
        embeds: [successEmbed(`🎁 ¡Obtuviste una carta NFT! **${drop.name}** (${drop.rarity})`)],
        flags: 64
      });
    }
  }

  if (customId.startsWith('crash_newgame_') || customId.startsWith('crash_back_')) {
    await interaction.deferUpdate();
    endGame(userId);
    
    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const buttons = createSetupButtons(userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }
}

module.exports = { handle };
