const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeMatches = new Map();
const waitingPlayers = new Map();
const playerStates = new Map();

const MOVES = {
  attack: { name: 'Ataque', emoji: '⚔️', damage: [15, 25], critChance: 0.15, critMultiplier: 2.0 },
  heavy: { name: 'Ataque Pesado', emoji: '🗡️', damage: [25, 40], critChance: 0.10, critMultiplier: 1.8, missChance: 0.20 },
  defend: { name: 'Defender', emoji: '🛡️', damageReduction: 0.6, counterChance: 0.25, counterDamage: [10, 15] },
  dodge: { name: 'Esquivar', emoji: '💨', dodgeChance: 0.60, counterChance: 0.40, counterDamage: [8, 12] }
};

function createMatch(player1Id, stakes) {
  const matchId = `${player1Id}_${Date.now()}`;
  const match = {
    id: matchId,
    player1: player1Id,
    player2: null,
    stakes,
    p1Hp: 100,
    p2Hp: 100,
    currentTurn: null,
    p1Move: null,
    p2Move: null,
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
  match.state = 'fighting';
  match.currentTurn = Math.random() > 0.5 ? match.player1 : match.player2;
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

function calculateDamage(move, attacker, defender, defenderMove) {
  const moveData = MOVES[move];
  let damage = 0;
  let message = '';
  
  if (moveData.missChance && Math.random() < moveData.missChance) {
    return { damage: 0, message: `${moveData.emoji} ¡Falló el ataque!`, crit: false };
  }
  
  if (defenderMove === 'dodge') {
    const luckBonus = getNftLuckBonus(defender);
    if (Math.random() < (MOVES.dodge.dodgeChance + luckBonus)) {
      if (Math.random() < MOVES.dodge.counterChance) {
        const counterDmg = MOVES.dodge.counterDamage;
        damage = -Math.floor(Math.random() * (counterDmg[1] - counterDmg[0] + 1)) + counterDmg[0];
        return { damage, message: `💨 ¡Esquivó y contraatacó por ${Math.abs(damage)} daño!`, crit: false };
      }
      return { damage: 0, message: `💨 ¡Esquivó el ataque!`, crit: false };
    }
  }
  
  if (moveData.damage) {
    const [min, max] = moveData.damage;
    damage = Math.floor(Math.random() * (max - min + 1)) + min;
    
    const luckBonus = getNftLuckBonus(attacker);
    const crit = Math.random() < (moveData.critChance + luckBonus);
    if (crit) {
      damage = Math.floor(damage * moveData.critMultiplier);
      message = `${moveData.emoji} ¡CRÍTICO! ${damage} daño`;
    } else {
      message = `${moveData.emoji} ${moveData.name}: ${damage} daño`;
    }
    
    if (defenderMove === 'defend') {
      damage = Math.floor(damage * (1 - MOVES.defend.damageReduction));
      message += ` (bloqueado: ${Math.floor(damage * MOVES.defend.damageReduction)})`;
      
      if (Math.random() < MOVES.defend.counterChance) {
        const counterDmg = MOVES.defend.counterDamage;
        const counter = Math.floor(Math.random() * (counterDmg[1] - counterDmg[0] + 1)) + counterDmg[0];
        damage -= counter;
        message += ` 🛡️ ¡Contraataque: ${counter}!`;
      }
    }
    
    return { damage, message, crit };
  }
  
  return { damage: 0, message: `${moveData.emoji} ${moveData.name}`, crit: false };
}

function processRound(match) {
  const p1Move = match.p1Move;
  const p2Move = match.p2Move;
  
  const p1Result = calculateDamage(p1Move, match.player1, match.player2, p2Move);
  const p2Result = calculateDamage(p2Move, match.player2, match.player1, p1Move);
  
  match.p2Hp = Math.max(0, match.p2Hp - p1Result.damage);
  match.p1Hp = Math.max(0, match.p1Hp - p2Result.damage);
  
  match.log.push({
    p1Move: p1Move,
    p2Move: p2Move,
    p1Damage: p1Result.damage,
    p2Damage: p2Result.damage,
    p1Message: p1Result.message,
    p2Message: p2Result.message
  });
  
  match.p1Move = null;
  match.p2Move = null;
  
  if (match.p1Hp <= 0 || match.p2Hp <= 0) {
    match.state = 'finished';
    if (match.p1Hp <= 0 && match.p2Hp <= 0) {
      match.winner = null;
    } else if (match.p1Hp <= 0) {
      match.winner = match.player2;
    } else {
      match.winner = match.player1;
    }
  }
  
  return { p1Result, p2Result };
}

function createHpBar(hp, max = 100) {
  const filled = Math.round((hp / max) * 10);
  const empty = 10 - filled;
  return `${'🟩'.repeat(filled)}${'⬛'.repeat(empty)} ${hp}/${max}`;
}

function createMatchEmbed(match, perspective) {
  const isP1 = perspective === match.player1;
  const yourHp = isP1 ? match.p1Hp : match.p2Hp;
  const theirHp = isP1 ? match.p2Hp : match.p1Hp;
  const opponent = isP1 ? match.player2 : match.player1;
  
  let description = `⚔️ **ARENA DUEL** ⚔️\n\n`;
  description += `**Tú:** ${createHpBar(yourHp)}\n`;
  description += `**Oponente:** <@${opponent}> ${createHpBar(theirHp)}\n\n`;
  description += `💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()} c/u\n`;
  description += `🏆 **Premio:** ${config.CURRENCY_SYMBOL} ${(match.stakes * 2).toLocaleString()}\n\n`;
  
  if (match.log.length > 0) {
    const lastRound = match.log[match.log.length - 1];
    description += `**Última ronda:**\n`;
    description += `• Tú: ${isP1 ? lastRound.p1Message : lastRound.p2Message}\n`;
    description += `• Oponente: ${isP1 ? lastRound.p2Message : lastRound.p1Message}\n\n`;
  }
  
  const yourMove = isP1 ? match.p1Move : match.p2Move;
  const theirMove = isP1 ? match.p2Move : match.p1Move;
  
  if (yourMove) {
    description += `✅ Seleccionaste: **${MOVES[yourMove].name}**\n`;
    if (!theirMove) {
      description += `⏳ Esperando al oponente...\n`;
    }
  } else {
    description += `*Selecciona tu movimiento*\n`;
  }

  let color = 0x50c878;
  if (match.state === 'finished') {
    if (match.winner === perspective) {
      color = 0x00ff00;
      description = `🏆 **¡VICTORIA!** 🏆\n\n` + description;
    } else if (match.winner === null) {
      color = 0xffff00;
      description = `🤝 **¡EMPATE!** 🤝\n\n` + description;
    } else {
      color = 0xff0000;
      description = `💀 **¡DERROTA!** 💀\n\n` + description;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚔️ ARENA DUEL 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Lucha con honor!'
  });
}

function createWaitingEmbed(match, userId) {
  const balance = economy.getBalance(userId);
  
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚔️ ARENA DUEL 🍀`,
    description: `⏳ **Esperando oponente...**\n\n💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}\n🏆 **Premio potencial:** ${config.CURRENCY_SYMBOL} ${(match.stakes * 2).toLocaleString()}\n\n*Otro jugador debe unirse para comenzar*`,
    color: 0xffaa00,
    footer: 'Emerald Isle Casino ® - ¡Prepárate para la batalla!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `⚔️ **Apuesta actual:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  
  if (availableMatches.length > 0) {
    description += `**Duelos disponibles:**\n`;
    for (const m of availableMatches.slice(0, 5)) {
      description += `• <@${m.player1}> - ${config.CURRENCY_SYMBOL} ${m.stakes.toLocaleString()}\n`;
    }
    description += `\n`;
  }
  
  description += `*Crea un duelo o únete a uno existente*`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - ⚔️ ARENA DUEL 🍀`,
    description,
    color: 0x50c878,
    footer: 'Emerald Isle Casino ® - ¡Combate PvP por turnos!'
  });
}

function createMoveButtons(userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`duel_attack_${userId}`).setLabel('⚔️ Ataque').setStyle(ButtonStyle.Primary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`duel_heavy_${userId}`).setLabel('🗡️ Pesado').setStyle(ButtonStyle.Danger).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`duel_defend_${userId}`).setLabel('🛡️ Defender').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`duel_dodge_${userId}`).setLabel('💨 Esquivar').setStyle(ButtonStyle.Success).setDisabled(disabled)
  );
}

const setupState = new Map();

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_duel') {
    await interaction.deferReply({ flags: 64 });
    
    const existingMatch = getMatch(userId);
    if (existingMatch && existingMatch.state === 'fighting') {
      const embed = createMatchEmbed(existingMatch, userId);
      const yourMove = existingMatch.player1 === userId ? existingMatch.p1Move : existingMatch.p2Move;
      const buttons = createMoveButtons(userId, !!yourMove);
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }
    
    if (existingMatch && existingMatch.state === 'waiting') {
      const embed = createWaitingEmbed(existingMatch, userId);
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
      );
      return interaction.editReply({ embeds: [embed], components: [buttons] });
    }

    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
    const joinButtons = availableMatches.slice(0, 3).map(m => 
      new ButtonBuilder().setCustomId(`duel_join_${m.id}_${userId}`).setLabel(`Unirse ${config.CURRENCY_SYMBOL} ${m.stakes}`).setStyle(ButtonStyle.Success)
    );
    
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duel_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel_create_${userId}`).setLabel('⚔️ Crear Duelo').setStyle(ButtonStyle.Primary)
      )
    ];
    
    if (joinButtons.length > 0) {
      rows.push(new ActionRowBuilder().addComponents(joinButtons));
    }

    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duel_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duel_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel_create_${userId}`).setLabel('⚔️ Crear Duelo').setStyle(ButtonStyle.Primary)
      )
    ];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duel_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duel_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel_create_${userId}`).setLabel('⚔️ Crear Duelo').setStyle(ButtonStyle.Primary)
      )
    ];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duel_create_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    
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

    const match = createMatch(userId, setup.bet);
    setupState.delete(userId);
    
    const embed = createWaitingEmbed(match, userId);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duel_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
    );

    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  if (customId.startsWith('duel_join_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const matchId = `${parts[2]}_${parts[3]}`;
    
    const match = activeMatches.get(matchId);
    if (!match || match.state !== 'waiting') {
      return interaction.followUp({
        embeds: [errorEmbed('Este duelo ya no está disponible.')],
        flags: 64
      });
    }

    const balance = economy.getBalance(userId);
    if (balance < match.stakes) {
      return interaction.followUp({
        embeds: [errorEmbed(`Necesitas ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()} para unirte.`)],
        flags: 64
      });
    }

    if (!economy.deductForBet(userId, match.stakes)) {
      return interaction.followUp({
        embeds: [errorEmbed('No se pudo procesar la apuesta.')],
        flags: 64
      });
    }

    joinMatch(matchId, userId);
    
    const embed = createMatchEmbed(match, userId);
    const buttons = createMoveButtons(userId);

    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  if (customId.startsWith('duel_cancel_')) {
    await interaction.deferUpdate();
    
    const match = getMatch(userId);
    if (match && match.state === 'waiting' && match.player1 === userId) {
      economy.addWinnings(userId, match.stakes);
      deleteMatch(match.id);
    }

    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duel_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duel_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duel_create_${userId}`).setLabel('⚔️ Crear Duelo').setStyle(ButtonStyle.Primary)
      )
    ];

    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duel_attack_') || customId.startsWith('duel_heavy_') || 
      customId.startsWith('duel_defend_') || customId.startsWith('duel_dodge_')) {
    await interaction.deferUpdate();
    
    const move = customId.split('_')[1];
    const match = getMatch(userId);
    
    if (!match || match.state !== 'fighting') {
      return interaction.followUp({
        embeds: [errorEmbed('No tienes un duelo activo.')],
        flags: 64
      });
    }

    if (match.player1 === userId) {
      if (match.p1Move) return;
      match.p1Move = move;
    } else {
      if (match.p2Move) return;
      match.p2Move = move;
    }

    if (match.p1Move && match.p2Move) {
      processRound(match);
      
      if (match.state === 'finished') {
        if (match.winner) {
          let prize = match.stakes * 2;
          prize = applyNftBonus(match.winner, prize, true);
          economy.addWinnings(match.winner, prize);
          updateStats(match.winner, 'arena_duel', match.stakes, prize, true);
          
          const loser = match.winner === match.player1 ? match.player2 : match.player1;
          updateStats(loser, 'arena_duel', match.stakes, 0, false);
          
          const drop = maybeDrop(match.winner, 'arena_duel');
          if (drop) {
            try {
              await interaction.channel.send({
                content: `<@${match.winner}>`,
                embeds: [successEmbed(`🎁 ¡Obtuviste una carta NFT! **${drop.name}** (${drop.rarity})`)]
              });
            } catch (e) {}
          }
        } else {
          economy.addWinnings(match.player1, match.stakes);
          economy.addWinnings(match.player2, match.stakes);
        }
        
        deleteMatch(match.id);
      }
    }

    const embed = createMatchEmbed(match, userId);
    const yourMove = match.player1 === userId ? match.p1Move : match.p2Move;
    const buttons = createMoveButtons(userId, !!yourMove || match.state === 'finished');

    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }
}

module.exports = { handle };
