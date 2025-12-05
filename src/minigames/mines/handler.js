const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeSessions = new Map();

const MINE_MULTIPLIERS = {
  1: [1.03, 1.08, 1.12, 1.18, 1.24, 1.30, 1.37, 1.46, 1.55, 1.65, 1.77, 1.90, 2.06, 2.25, 2.47, 2.75, 3.09, 3.54, 4.12, 4.95, 6.19, 8.25, 12.37, 24.75],
  3: [1.08, 1.17, 1.29, 1.41, 1.56, 1.74, 1.94, 2.18, 2.47, 2.83, 3.26, 3.81, 4.50, 5.40, 6.60, 8.25, 10.61, 14.14, 19.80, 29.70, 49.50, 99.00],
  5: [1.24, 1.56, 2.00, 2.58, 3.39, 4.52, 6.14, 8.50, 12.04, 17.52, 26.27, 40.87, 66.41, 113.85, 208.72, 417.45, 939.26, 2504.70],
  10: [1.47, 2.18, 3.35, 5.35, 8.92, 15.59, 28.75, 56.35, 118.93, 273.94, 700.94, 2102.82, 7880.57, 39402.86],
  15: [1.80, 3.24, 6.23, 13.00, 29.95, 77.87, 233.60, 839.00, 3775.48, 22652.86, 226528.57],
  20: [2.40, 5.76, 16.20, 56.70, 272.16, 2041.20, 30618.00],
  24: [24.75, 618.75, 24750.00]
};

function createGrid(minesCount) {
  const grid = Array(25).fill(false);
  const positions = [];
  
  while (positions.length < minesCount) {
    const pos = Math.floor(Math.random() * 25);
    if (!positions.includes(pos)) {
      positions.push(pos);
      grid[pos] = true;
    }
  }
  
  return { grid, minePositions: positions };
}

function getSession(userId) {
  return activeSessions.get(userId);
}

function createSession(userId, bet, minesCount) {
  const { grid, minePositions } = createGrid(minesCount);
  const session = {
    bet,
    minesCount,
    grid,
    minePositions,
    revealed: [],
    multiplier: 1.0,
    state: 'playing',
    createdAt: Date.now()
  };
  activeSessions.set(userId, session);
  return session;
}

function endSession(userId) {
  activeSessions.delete(userId);
}

function getMultiplier(minesCount, revealed) {
  const multipliers = MINE_MULTIPLIERS[minesCount] || MINE_MULTIPLIERS[5];
  return multipliers[Math.min(revealed, multipliers.length - 1)] || multipliers[multipliers.length - 1];
}

function createGameEmbed(userId, session, status = 'playing') {
  const balance = economy.getBalance(userId);
  
  let gridDisplay = '';
  for (let i = 0; i < 25; i++) {
    if (session.revealed.includes(i)) {
      if (session.grid[i]) {
        gridDisplay += '💥';
      } else {
        gridDisplay += '💎';
      }
    } else if (status === 'lost') {
      if (session.grid[i]) {
        gridDisplay += '💣';
      } else {
        gridDisplay += '⬛';
      }
    } else {
      gridDisplay += '⬛';
    }
    if ((i + 1) % 5 === 0) gridDisplay += '\n';
  }

  const potentialWin = Math.floor(session.bet * session.multiplier);
  
  let description = `💰 **Saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${session.bet.toLocaleString()}\n`;
  description += `💣 **Minas:** ${session.minesCount}\n`;
  description += `💎 **Revelados:** ${session.revealed.filter(i => !session.grid[i]).length}/25\n`;
  description += `📈 **Multiplicador:** ${session.multiplier.toFixed(2)}x\n`;
  description += `💵 **Ganancia Potencial:** ${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}\n\n`;
  description += `${gridDisplay}`;

  let color = 0x50c878;
  let title = `💣 MINAS - Jugando`;

  if (status === 'won') {
    color = 0x00ff00;
    title = `💣 MINAS - ¡GANASTE!`;
    description += `\n\n🎉 **¡Cobraste ${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}!**`;
  } else if (status === 'lost') {
    color = 0xff0000;
    title = `💣 MINAS - ¡PERDISTE!`;
    description += `\n\n💥 **¡Encontraste una mina!**`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ${title} 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createSetupEmbed(userId, bet, minesCount) {
  const balance = economy.getBalance(userId);
  
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 💣 MINAS 🍀`,
    description: `Revela celdas sin encontrar minas. ¡Cuantas más reveles, mayor el multiplicador!\n\n💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n💣 **Minas:** ${minesCount}\n\n*Ajusta tu apuesta y cantidad de minas*`,
    color: 0x50c878,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createSetupButtons(bet, minesCount, userId) {
  const rows = [];
  
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`mines_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mines_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
  ));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines_mines_down_${userId}`).setLabel('➖ Minas').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mines_mines_up_${userId}`).setLabel('➕ Minas').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mines_preset_3_${userId}`).setLabel('3 💣').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mines_preset_5_${userId}`).setLabel('5 💣').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mines_preset_10_${userId}`).setLabel('10 💣').setStyle(ButtonStyle.Secondary)
  ));

  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mines_start_${userId}`).setLabel('🎮 JUGAR').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mines_back_${userId}`).setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
  ));

  return rows;
}

function createGridButtons(session, userId) {
  const rows = [];
  
  for (let row = 0; row < 5; row++) {
    const buttons = [];
    for (let col = 0; col < 5; col++) {
      const index = row * 5 + col;
      const isRevealed = session.revealed.includes(index);
      
      let style = ButtonStyle.Secondary;
      let label = `${index + 1}`;
      let disabled = isRevealed || session.state !== 'playing';

      if (isRevealed) {
        if (session.grid[index]) {
          label = '💥';
          style = ButtonStyle.Danger;
        } else {
          label = '💎';
          style = ButtonStyle.Success;
        }
      }

      buttons.push(
        new ButtonBuilder()
          .setCustomId(`mines_cell_${index}_${userId}`)
          .setLabel(label)
          .setStyle(style)
          .setDisabled(disabled)
      );
    }
    rows.push(new ActionRowBuilder().addComponents(buttons));
  }

  return rows;
}

function createCashoutButton(userId, enabled = true) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mines_cashout_${userId}`)
      .setLabel('💰 COBRAR')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!enabled),
    new ButtonBuilder()
      .setCustomId(`mines_newgame_${userId}`)
      .setLabel('🔄 Nuevo Juego')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(enabled)
  );
}

const setupState = new Map();

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_mines') {
    await interaction.deferReply({ flags: 64 });
    
    const existingSession = getSession(userId);
    if (existingSession && existingSession.state === 'playing') {
      const embed = createGameEmbed(userId, existingSession);
      const gridButtons = createGridButtons(existingSession, userId);
      const cashoutRow = createCashoutButton(userId, existingSession.revealed.length > 0);
      
      return interaction.editReply({
        embeds: [embed],
        components: [...gridButtons.slice(0, 4), cashoutRow]
      });
    }

    setupState.set(userId, { bet: 100, minesCount: 5 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_bet_max_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, 10000);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_mines_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    setup.minesCount = Math.max(1, setup.minesCount - 1);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_mines_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    setup.minesCount = Math.min(24, setup.minesCount + 1);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_preset_')) {
    await interaction.deferUpdate();
    const preset = parseInt(customId.split('_')[2]);
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    setup.minesCount = preset;
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('mines_start_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100, minesCount: 5 };
    
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

    const session = createSession(userId, setup.bet, setup.minesCount);
    setupState.delete(userId);

    const embed = createGameEmbed(userId, session);
    const gridButtons = createGridButtons(session, userId);
    const cashoutRow = createCashoutButton(userId, false);

    return interaction.editReply({
      embeds: [embed],
      components: [...gridButtons.slice(0, 4), cashoutRow]
    });
  }

  if (customId.startsWith('mines_cell_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const cellIndex = parseInt(parts[2]);
    
    const session = getSession(userId);
    if (!session || session.state !== 'playing') {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes una partida activa.')],
        flags: 64
      });
    }

    if (session.revealed.includes(cellIndex)) {
      return;
    }

    session.revealed.push(cellIndex);

    if (session.grid[cellIndex]) {
      session.state = 'lost';
      updateStats(userId, 'mines', session.bet, 0, false);
      
      const embed = createGameEmbed(userId, session, 'lost');
      const gridButtons = createGridButtons(session, userId);
      const cashoutRow = createCashoutButton(userId, false);
      
      endSession(userId);
      
      return interaction.editReply({
        embeds: [embed],
        components: [...gridButtons.slice(0, 4), cashoutRow]
      });
    }

    const revealedGems = session.revealed.filter(i => !session.grid[i]).length;
    session.multiplier = getMultiplier(session.minesCount, revealedGems);

    const safeSpots = 25 - session.minesCount;
    if (revealedGems >= safeSpots) {
      session.state = 'won';
      let payout = Math.floor(session.bet * session.multiplier);
      payout = applyNftBonus(userId, payout, true);
      economy.addWinnings(userId, payout);
      updateStats(userId, 'mines', session.bet, payout, true);
      
      const drop = maybeDrop(userId, 'mines');
      
      const embed = createGameEmbed(userId, session, 'won');
      const gridButtons = createGridButtons(session, userId);
      const cashoutRow = createCashoutButton(userId, false);
      
      endSession(userId);
      
      let reply = await interaction.editReply({
        embeds: [embed],
        components: [...gridButtons.slice(0, 4), cashoutRow]
      });

      if (drop) {
        await interaction.followUp({
          embeds: [successEmbed(`🎁 ¡Obtuviste una carta NFT! **${drop.name}** (${drop.rarity})`)],
          flags: 64
        });
      }
      
      return reply;
    }

    const embed = createGameEmbed(userId, session);
    const gridButtons = createGridButtons(session, userId);
    const cashoutRow = createCashoutButton(userId, true);

    return interaction.editReply({
      embeds: [embed],
      components: [...gridButtons.slice(0, 4), cashoutRow]
    });
  }

  if (customId.startsWith('mines_cashout_')) {
    await interaction.deferUpdate();
    
    const session = getSession(userId);
    if (!session || session.state !== 'playing') {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes una partida activa.')],
        flags: 64
      });
    }

    if (session.revealed.length === 0) {
      return interaction.followUp({
        embeds: [errorEmbed('Debes revelar al menos una celda para cobrar.')],
        flags: 64
      });
    }

    session.state = 'won';
    let payout = Math.floor(session.bet * session.multiplier);
    payout = applyNftBonus(userId, payout, true);
    economy.addWinnings(userId, payout);
    updateStats(userId, 'mines', session.bet, payout, true);
    
    const drop = maybeDrop(userId, 'mines');

    const embed = createGameEmbed(userId, session, 'won');
    const gridButtons = createGridButtons(session, userId);
    const cashoutRow = createCashoutButton(userId, false);

    endSession(userId);

    let reply = await interaction.editReply({
      embeds: [embed],
      components: [...gridButtons.slice(0, 4), cashoutRow]
    });

    if (drop) {
      await interaction.followUp({
        embeds: [successEmbed(`🎁 ¡Obtuviste una carta NFT! **${drop.name}** (${drop.rarity})`)],
        flags: 64
      });
    }

    return reply;
  }

  if (customId.startsWith('mines_newgame_') || customId.startsWith('mines_back_')) {
    await interaction.deferUpdate();
    endSession(userId);
    
    setupState.set(userId, { bet: 100, minesCount: 5 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet, setup.minesCount);
    const buttons = createSetupButtons(setup.bet, setup.minesCount, userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }
}

module.exports = { handle };
