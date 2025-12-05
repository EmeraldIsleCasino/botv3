const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeSessions = new Map();
const setupState = new Map();

const DIFFICULTY_MODES = {
  easy: { name: 'Fácil', columns: 4, bombs: 1, multiplierBase: 1.2, emoji: '🟢' },
  medium: { name: 'Medio', columns: 3, bombs: 1, multiplierBase: 1.5, emoji: '🟡' },
  hard: { name: 'Difícil', columns: 3, bombs: 2, multiplierBase: 2.0, emoji: '🔴' }
};

function createSession(userId, bet, difficulty = 'medium') {
  const mode = DIFFICULTY_MODES[difficulty];
  const session = {
    bet,
    difficulty,
    mode,
    currentFloor: 0,
    multiplier: 1.0,
    state: 'playing',
    path: [],
    floors: generateFloors(mode, 10),
    createdAt: Date.now()
  };
  activeSessions.set(userId, session);
  return session;
}

function generateFloors(mode, count) {
  const floors = [];
  for (let i = 0; i < count; i++) {
    const floor = Array(mode.columns).fill('safe');
    const bombPositions = [];
    
    while (bombPositions.length < mode.bombs) {
      const pos = Math.floor(Math.random() * mode.columns);
      if (!bombPositions.includes(pos)) {
        bombPositions.push(pos);
        floor[pos] = 'bomb';
      }
    }
    
    floors.push(floor);
  }
  return floors;
}

function getSession(userId) {
  return activeSessions.get(userId);
}

function endSession(userId) {
  activeSessions.delete(userId);
}

function climbFloor(userId, choice) {
  const session = getSession(userId);
  if (!session || session.state !== 'playing') return null;
  
  const currentFloor = session.floors[session.currentFloor];
  const result = currentFloor[choice];
  
  session.path.push({ floor: session.currentFloor, choice, result });
  
  if (result === 'bomb') {
    session.state = 'lost';
    return { success: false, result: 'bomb' };
  }
  
  session.currentFloor++;
  session.multiplier = Math.pow(session.mode.multiplierBase, session.currentFloor);
  
  if (session.currentFloor >= session.floors.length) {
    session.state = 'won';
    return { success: true, result: 'top' };
  }
  
  return { success: true, result: 'safe' };
}

function createTowerDisplay(session, revealed = false) {
  let display = '';
  const totalFloors = session.floors.length;
  
  for (let i = totalFloors - 1; i >= 0; i--) {
    const floor = session.floors[i];
    const floorNum = (i + 1).toString().padStart(2, ' ');
    const mult = Math.pow(session.mode.multiplierBase, i + 1).toFixed(2);
    
    let cells = '';
    for (let j = 0; j < floor.length; j++) {
      const pathEntry = session.path.find(p => p.floor === i);
      
      if (pathEntry && pathEntry.choice === j) {
        if (pathEntry.result === 'bomb') {
          cells += '💥';
        } else {
          cells += '✅';
        }
      } else if (i < session.currentFloor || revealed) {
        if (floor[j] === 'bomb') {
          cells += '💣';
        } else {
          cells += '⬜';
        }
      } else if (i === session.currentFloor) {
        cells += '❓';
      } else {
        cells += '⬛';
      }
    }
    
    const isCurrentFloor = i === session.currentFloor && session.state === 'playing';
    const prefix = isCurrentFloor ? '▶️' : '  ';
    display += `${prefix} ${floorNum} │ ${cells} │ ${mult}x\n`;
  }
  
  display += `${'─'.repeat(20)}\n`;
  display += `   🏠 │ ${'🚪'.repeat(session.mode.columns)} │ INICIO`;
  
  return display;
}

function createGameEmbed(userId, session, status = 'playing') {
  const balance = economy.getBalance(userId);
  const potentialWin = Math.floor(session.bet * session.multiplier);
  
  let description = `🗼 **TOWER** 🗼\n\n`;
  description += `\`\`\`\n${createTowerDisplay(session, status !== 'playing')}\`\`\`\n`;
  description += `💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${session.bet.toLocaleString()}\n`;
  description += `🏢 **Piso:** ${session.currentFloor}/${session.floors.length}\n`;
  description += `📈 **Multiplicador:** ${session.multiplier.toFixed(2)}x\n`;
  description += `💵 **Ganancia:** ${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}\n`;
  description += `${session.mode.emoji} **Modo:** ${session.mode.name}\n`;
  
  let color = 0x3498db;
  let title = 'Subiendo...';

  if (status === 'won' || session.state === 'won') {
    color = 0x00ff00;
    title = '¡COBRADO!';
    description += `\n🎉 **¡Ganaste ${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}!**`;
  } else if (status === 'lost' || session.state === 'lost') {
    color = 0xff0000;
    title = '¡CAÍSTE!';
    description += `\n💥 **¡Encontraste una bomba!**`;
  } else if (session.currentFloor > 0) {
    description += `\n*Elige una puerta o cobra tu ganancia*`;
  } else {
    description += `\n*Elige una puerta para comenzar a subir*`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🗼 ${title} 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Sube más alto!'
  });
}

function createSetupEmbed(userId, bet, difficulty) {
  const balance = economy.getBalance(userId);
  const mode = DIFFICULTY_MODES[difficulty];
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Modos de dificultad:**\n`;
  
  for (const [key, m] of Object.entries(DIFFICULTY_MODES)) {
    const selected = key === difficulty ? ' ← SELECCIONADO' : '';
    description += `${m.emoji} **${m.name}**${selected}\n`;
    description += `   ${m.columns} puertas, ${m.bombs} bomba(s), ${m.multiplierBase}x por piso\n`;
  }
  
  description += `\n*Más difícil = Mayor multiplicador*`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🗼 TOWER 🍀`,
    description,
    color: 0x3498db,
    footer: 'Emerald Isle Casino ® - ¡Sube la torre!'
  });
}

function createSetupButtons(userId, difficulty) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tower_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`tower_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`tower_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tower_diff_easy_${userId}`).setLabel('🟢 Fácil').setStyle(difficulty === 'easy' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`tower_diff_medium_${userId}`).setLabel('🟡 Medio').setStyle(difficulty === 'medium' ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`tower_diff_hard_${userId}`).setLabel('🔴 Difícil').setStyle(difficulty === 'hard' ? ButtonStyle.Success : ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`tower_start_${userId}`).setLabel('🗼 COMENZAR').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`tower_back_${userId}`).setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
    )
  ];
}

function createClimbButtons(session, userId) {
  const doorEmojis = ['🚪', '🚪', '🚪', '🚪'];
  const doorLabels = ['A', 'B', 'C', 'D'];
  const disabled = session.state !== 'playing';
  
  const doorButtons = [];
  for (let i = 0; i < session.mode.columns; i++) {
    doorButtons.push(
      new ButtonBuilder()
        .setCustomId(`tower_door_${i}_${userId}`)
        .setLabel(`${doorLabels[i]}`)
        .setEmoji('🚪')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled)
    );
  }
  
  const rows = [new ActionRowBuilder().addComponents(doorButtons)];
  
  if (session.currentFloor > 0 && session.state === 'playing') {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tower_cashout_${userId}`)
        .setLabel(`💰 COBRAR ${session.multiplier.toFixed(2)}x`)
        .setStyle(ButtonStyle.Success)
    ));
  }
  
  if (session.state !== 'playing') {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`tower_newgame_${userId}`)
        .setLabel('🔄 Nuevo Juego')
        .setStyle(ButtonStyle.Primary)
    ));
  }
  
  return rows;
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_tower') {
    await interaction.deferReply({ flags: 64 });
    
    const existingSession = getSession(userId);
    if (existingSession && existingSession.state === 'playing') {
      const embed = createGameEmbed(userId, existingSession);
      const buttons = createClimbButtons(existingSession, userId);
      return interaction.editReply({ embeds: [embed], components: buttons });
    }

    setupState.set(userId, { bet: 100, difficulty: 'medium' });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, difficulty: 'medium' };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, difficulty: 'medium' };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_bet_max_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, difficulty: 'medium' };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, 10000);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_diff_')) {
    await interaction.deferUpdate();
    const difficulty = customId.split('_')[2];
    const setup = setupState.get(userId) || { bet: 100, difficulty: 'medium' };
    setup.difficulty = difficulty;
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_start_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, difficulty: 'medium' };
    
    const balance = economy.getBalance(userId);
    if (balance < setup.bet) {
      return interaction.followUp({
        embeds: [errorEmbed(`Saldo insuficiente.`)],
        flags: 64
      });
    }

    if (!economy.deductForBet(userId, setup.bet)) {
      return interaction.followUp({
        embeds: [errorEmbed('Error al procesar apuesta.')],
        flags: 64
      });
    }

    const session = createSession(userId, setup.bet, setup.difficulty);
    setupState.delete(userId);

    const embed = createGameEmbed(userId, session);
    const buttons = createClimbButtons(session, userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_door_')) {
    await interaction.deferUpdate();
    const doorIndex = parseInt(customId.split('_')[2]);
    
    const session = getSession(userId);
    if (!session || session.state !== 'playing') {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes una partida activa.')],
        flags: 64
      });
    }

    const result = climbFloor(userId, doorIndex);
    
    if (!result.success) {
      updateStats(userId, 'tower', session.bet, 0, false);
      const embed = createGameEmbed(userId, session, 'lost');
      const buttons = createClimbButtons(session, userId);
      endSession(userId);
      return interaction.editReply({ embeds: [embed], components: buttons });
    }

    if (result.result === 'top') {
      let payout = Math.floor(session.bet * session.multiplier);
      payout = applyNftBonus(userId, payout, true);
      economy.addWinnings(userId, payout);
      updateStats(userId, 'tower', session.bet, payout, true);
      
      const drop = maybeDrop(userId, 'tower');
      const embed = createGameEmbed(userId, session, 'won');
      const buttons = createClimbButtons(session, userId);
      endSession(userId);
      
      await interaction.editReply({ embeds: [embed], components: buttons });
      
      if (drop) {
        await interaction.followUp({
          embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)],
          flags: 64
        });
      }
      return;
    }

    const embed = createGameEmbed(userId, session);
    const buttons = createClimbButtons(session, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('tower_cashout_')) {
    await interaction.deferUpdate();
    
    const session = getSession(userId);
    if (!session || session.state !== 'playing') {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes una partida activa.')],
        flags: 64
      });
    }

    session.state = 'won';
    let payout = Math.floor(session.bet * session.multiplier);
    payout = applyNftBonus(userId, payout, true);
    economy.addWinnings(userId, payout);
    updateStats(userId, 'tower', session.bet, payout, true);
    
    const drop = maybeDrop(userId, 'tower');

    const embed = createGameEmbed(userId, session, 'won');
    const buttons = createClimbButtons(session, userId);

    endSession(userId);

    await interaction.editReply({ embeds: [embed], components: buttons });

    if (drop) {
      await interaction.followUp({
        embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)],
        flags: 64
      });
    }
  }

  if (customId.startsWith('tower_newgame_') || customId.startsWith('tower_back_')) {
    await interaction.deferUpdate();
    endSession(userId);
    
    setupState.set(userId, { bet: 100, difficulty: 'medium' });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet, setup.difficulty);
    const buttons = createSetupButtons(userId, setup.difficulty);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }
}

module.exports = { handle };
