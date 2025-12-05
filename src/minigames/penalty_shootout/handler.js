const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeMatches = new Map();
const waitingPlayers = new Map();
const setupState = new Map();

const DIRECTIONS = {
  left: { name: 'Izquierda', emoji: '⬅️' },
  center: { name: 'Centro', emoji: '⬆️' },
  right: { name: 'Derecha', emoji: '➡️' }
};

function createMatch(player1Id, stakes) {
  const matchId = `pen_${player1Id}_${Date.now()}`;
  const match = {
    id: matchId,
    player1: player1Id,
    player2: null,
    stakes,
    p1Score: 0,
    p2Score: 0,
    currentRound: 1,
    maxRounds: 5,
    currentShooter: null,
    p1Choice: null,
    p2Choice: null,
    phase: 'shooting',
    state: 'waiting',
    log: [],
    createdAt: Date.now()
  };
  activeMatches.set(matchId, match);
  waitingPlayers.set(player1Id, matchId);
  return match;
}

function joinMatch(matchId, player2Id) {
  const match = activeMatches.get(matchId);
  if (!match || match.state !== 'waiting') return null;
  if (match.player1 === player2Id) return null;
  
  match.player2 = player2Id;
  match.state = 'playing';
  match.currentShooter = match.player1;
  waitingPlayers.delete(match.player1);
  
  return match;
}

function getMatch(userId) {
  for (const [id, match] of activeMatches) {
    if (match.player1 === userId || match.player2 === userId) {
      return match;
    }
  }
  return null;
}

function deleteMatch(matchId) {
  const match = activeMatches.get(matchId);
  if (match) {
    waitingPlayers.delete(match.player1);
    if (match.player2) waitingPlayers.delete(match.player2);
  }
  activeMatches.delete(matchId);
}

function processShot(match) {
  const shooterChoice = match.currentShooter === match.player1 ? match.p1Choice : match.p2Choice;
  const keeperChoice = match.currentShooter === match.player1 ? match.p2Choice : match.p1Choice;
  
  const luckBonus = getNftLuckBonus(match.currentShooter);
  const saved = shooterChoice === keeperChoice && Math.random() > (0.3 + luckBonus);
  const goal = !saved;
  
  if (goal) {
    if (match.currentShooter === match.player1) {
      match.p1Score++;
    } else {
      match.p2Score++;
    }
  }
  
  match.log.push({
    round: match.currentRound,
    shooter: match.currentShooter,
    shootDir: shooterChoice,
    keeperDir: keeperChoice,
    goal
  });
  
  match.p1Choice = null;
  match.p2Choice = null;
  
  if (match.currentShooter === match.player2) {
    match.currentRound++;
  }
  
  match.currentShooter = match.currentShooter === match.player1 ? match.player2 : match.player1;
  
  const p1Remaining = match.maxRounds - Math.ceil(match.currentRound / 2) + (match.currentShooter === match.player1 ? 1 : 0);
  const p2Remaining = match.maxRounds - Math.floor(match.currentRound / 2) + (match.currentShooter === match.player2 ? 1 : 0);
  
  if (match.currentRound > match.maxRounds) {
    if (match.p1Score !== match.p2Score) {
      match.state = 'finished';
      match.winner = match.p1Score > match.p2Score ? match.player1 : match.player2;
    } else {
      match.phase = 'sudden_death';
      match.maxRounds++;
    }
  } else if (match.p1Score > match.p2Score + p2Remaining || match.p2Score > match.p1Score + p1Remaining) {
    match.state = 'finished';
    match.winner = match.p1Score > match.p2Score ? match.player1 : match.player2;
  }
  
  return { goal, shooterChoice, keeperChoice };
}

function createGoalDisplay(lastShot) {
  if (!lastShot) return '';
  
  const goal = '┌───────────────────┐\n│                   │\n│                   │\n└───────────────────┘';
  return goal;
}

function createMatchEmbed(match, perspective) {
  const isP1 = perspective === match.player1;
  const yourScore = isP1 ? match.p1Score : match.p2Score;
  const theirScore = isP1 ? match.p2Score : match.p1Score;
  const opponent = isP1 ? match.player2 : match.player1;
  const isShooter = match.currentShooter === perspective;
  
  let description = `⚽ **PENALTY SHOOTOUT** ⚽\n\n`;
  description += `**Marcador:**\n`;
  description += `Tú: ${'⚽'.repeat(yourScore)}${'⚪'.repeat(Math.max(0, match.maxRounds - yourScore))} **${yourScore}**\n`;
  description += `<@${opponent}>: ${'⚽'.repeat(theirScore)}${'⚪'.repeat(Math.max(0, match.maxRounds - theirScore))} **${theirScore}**\n\n`;
  description += `📍 **Ronda ${match.currentRound}/${match.maxRounds}**\n`;
  description += `💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}\n\n`;
  
  if (match.phase === 'sudden_death') {
    description += `⚡ **¡MUERTE SÚBITA!**\n\n`;
  }
  
  if (match.log.length > 0) {
    const lastShot = match.log[match.log.length - 1];
    const wasYou = lastShot.shooter === perspective;
    description += `**Último tiro:**\n`;
    description += wasYou ? 
      `${lastShot.goal ? '⚽ ¡GOL!' : '❌ ¡Atajado!'} Tiraste: ${DIRECTIONS[lastShot.shootDir].emoji}\n` :
      `${lastShot.goal ? '⚽ Gol rival' : '🧤 ¡Atajaste!'} Rival tiró: ${DIRECTIONS[lastShot.shootDir].emoji}\n`;
    description += `\n`;
  }
  
  if (match.state === 'playing') {
    if (isShooter) {
      description += `🎯 **Tu turno de TIRAR**\n*Elige dirección del disparo*`;
    } else {
      description += `🧤 **Tu turno de ATAJAR**\n*Elige dirección para lanzarte*`;
    }
  }
  
  const yourChoice = isP1 ? match.p1Choice : match.p2Choice;
  if (yourChoice) {
    description += `\n\n✅ Elegiste: **${DIRECTIONS[yourChoice].name}**\n⏳ Esperando rival...`;
  }

  let color = 0x00aa00;
  if (match.state === 'finished') {
    if (match.winner === perspective) {
      color = 0x00ff00;
      description = `🏆 **¡VICTORIA!** 🏆\n\n` + description;
    } else {
      color = 0xff0000;
      description = `💔 **¡DERROTA!** 💔\n\n` + description;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚽ PENALES 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡A la red!'
  });
}

function createWaitingEmbed(match, userId) {
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚽ PENALES 🍀`,
    description: `⏳ **Esperando rival...**\n\n💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}\n🏆 **Premio:** ${config.CURRENCY_SYMBOL} ${(match.stakes * 2).toLocaleString()}\n\n5 tiros por jugador\n¡Empate = muerte súbita!`,
    color: 0xffaa00,
    footer: 'Emerald Isle Casino ® - ¡Prepárate!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `⚽ **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Cómo jugar:**\n`;
  description += `• 5 rondas de tiros alternados\n`;
  description += `• Tirador elige dirección del disparo\n`;
  description += `• Portero elige dirección para lanzarse\n`;
  description += `• Empate = muerte súbita\n\n`;
  
  if (availableMatches.length > 0) {
    description += `**Partidos disponibles:**\n`;
    for (const m of availableMatches.slice(0, 3)) {
      description += `• <@${m.player1}> - ${config.CURRENCY_SYMBOL} ${m.stakes.toLocaleString()}\n`;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚽ PENALES 🍀`,
    description,
    color: 0x00aa00,
    footer: 'Emerald Isle Casino ® - ¡Tiros penales PvP!'
  });
}

function createDirectionButtons(userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`penalty_left_${userId}`).setLabel('⬅️ Izquierda').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`penalty_center_${userId}`).setLabel('⬆️ Centro').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`penalty_right_${userId}`).setLabel('➡️ Derecha').setStyle(ButtonStyle.Primary).setDisabled(disabled)
  );
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_penalty') {
    await interaction.deferReply({ flags: 64 });
    
    const existingMatch = getMatch(userId);
    if (existingMatch && existingMatch.state === 'playing') {
      const yourChoice = existingMatch.player1 === userId ? existingMatch.p1Choice : existingMatch.p2Choice;
      const embed = createMatchEmbed(existingMatch, userId);
      const buttons = createDirectionButtons(userId, !!yourChoice);
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }
    
    if (existingMatch && existingMatch.state === 'waiting') {
      const embed = createWaitingEmbed(existingMatch, userId);
      const buttons = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`penalty_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
      )];
      return interaction.editReply({ embeds: [embed], components: buttons });
    }

    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`penalty_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`penalty_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`penalty_create_${userId}`).setLabel('⚽ Crear Partido').setStyle(ButtonStyle.Primary)
      )
    ];
    
    if (availableMatches.length > 0) {
      const joinButtons = availableMatches.slice(0, 3).map(m => 
        new ButtonBuilder().setCustomId(`penalty_join_${m.id}_${userId}`).setLabel(`Unirse ${config.CURRENCY_SYMBOL} ${m.stakes}`).setStyle(ButtonStyle.Success)
      );
      rows.push(new ActionRowBuilder().addComponents(joinButtons));
    }

    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('penalty_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`penalty_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`penalty_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`penalty_create_${userId}`).setLabel('⚽ Crear Partido').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('penalty_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`penalty_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`penalty_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`penalty_create_${userId}`).setLabel('⚽ Crear Partido').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('penalty_create_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    if (balance < setup.bet) {
      return interaction.followUp({ embeds: [errorEmbed('Saldo insuficiente.')], flags: 64 });
    }
    if (!economy.deductForBet(userId, setup.bet)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar.')], flags: 64 });
    }
    const match = createMatch(userId, setup.bet);
    setupState.delete(userId);
    const embed = createWaitingEmbed(match, userId);
    const buttons = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`penalty_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
    )];
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('penalty_join_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const matchId = `pen_${parts[2]}_${parts[3]}`;
    const match = activeMatches.get(matchId);
    if (!match || match.state !== 'waiting') {
      return interaction.followUp({ embeds: [errorEmbed('Partido no disponible.')], flags: 64 });
    }
    const balance = economy.getBalance(userId);
    if (balance < match.stakes) {
      return interaction.followUp({ embeds: [errorEmbed(`Necesitas ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}.`)], flags: 64 });
    }
    if (!economy.deductForBet(userId, match.stakes)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar.')], flags: 64 });
    }
    joinMatch(matchId, userId);
    const embed = createMatchEmbed(match, userId);
    const buttons = createDirectionButtons(userId);
    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  if (customId.startsWith('penalty_cancel_')) {
    await interaction.deferUpdate();
    const match = getMatch(userId);
    if (match && match.state === 'waiting' && match.player1 === userId) {
      economy.addWinnings(userId, match.stakes);
      deleteMatch(match.id);
    }
    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`penalty_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`penalty_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`penalty_create_${userId}`).setLabel('⚽ Crear Partido').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  const directions = ['left', 'center', 'right'];
  for (const dir of directions) {
    if (customId.startsWith(`penalty_${dir}_`)) {
      await interaction.deferUpdate();
      const match = getMatch(userId);
      if (!match || match.state !== 'playing') {
        return interaction.followUp({ embeds: [errorEmbed('No tienes partido activo.')], flags: 64 });
      }
      
      if (match.player1 === userId) {
        if (match.p1Choice) return;
        match.p1Choice = dir;
      } else {
        if (match.p2Choice) return;
        match.p2Choice = dir;
      }

      if (match.p1Choice && match.p2Choice) {
        processShot(match);
        
        if (match.state === 'finished') {
          let prize = match.stakes * 2;
          prize = applyNftBonus(match.winner, prize, true);
          economy.addWinnings(match.winner, prize);
          updateStats(match.winner, 'penalty_shootout', match.stakes, prize, true);
          const loser = match.winner === match.player1 ? match.player2 : match.player1;
          updateStats(loser, 'penalty_shootout', match.stakes, 0, false);
          const drop = maybeDrop(match.winner, 'penalty_shootout');
          if (drop) {
            try {
              await interaction.channel.send({
                content: `<@${match.winner}>`,
                embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)]
              });
            } catch (e) {}
          }
          deleteMatch(match.id);
        }
      }

      const yourChoice = match.player1 === userId ? match.p1Choice : match.p2Choice;
      const embed = createMatchEmbed(match, userId);
      const buttons = createDirectionButtons(userId, !!yourChoice || match.state === 'finished');
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }
  }
}

module.exports = { handle };
