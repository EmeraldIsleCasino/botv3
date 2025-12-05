const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeMatches = new Map();
const waitingPlayers = new Map();
const setupState = new Map();

const MOVES = {
  jab: { name: 'Jab', emoji: '👊', damage: [8, 15], staminaCost: 10, speed: 1.2 },
  hook: { name: 'Hook', emoji: '🥊', damage: [15, 25], staminaCost: 20, speed: 0.9, koChance: 0.10 },
  uppercut: { name: 'Uppercut', emoji: '💥', damage: [20, 35], staminaCost: 30, speed: 0.7, koChance: 0.20 },
  block: { name: 'Bloquear', emoji: '🛡️', damageReduction: 0.7, staminaRecovery: 15, counterChance: 0.20 },
  dodge: { name: 'Esquivar', emoji: '💨', dodgeChance: 0.50, staminaCost: 15, counterChance: 0.35 }
};

function createMatch(player1Id, stakes) {
  const matchId = `box_${player1Id}_${Date.now()}`;
  const match = {
    id: matchId,
    player1: player1Id,
    player2: null,
    stakes,
    p1Hp: 100,
    p2Hp: 100,
    p1Stamina: 100,
    p2Stamina: 100,
    round: 1,
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

function processRound(match) {
  const p1Move = match.p1Move;
  const p2Move = match.p2Move;
  const roundLog = { round: match.round, p1: {}, p2: {} };

  const p1MoveData = MOVES[p1Move];
  const p2MoveData = MOVES[p2Move];

  let p1Damage = 0, p2Damage = 0;
  let p1Message = '', p2Message = '';

  if (p1MoveData.staminaCost) {
    match.p1Stamina = Math.max(0, match.p1Stamina - p1MoveData.staminaCost);
  }
  if (p1MoveData.staminaRecovery) {
    match.p1Stamina = Math.min(100, match.p1Stamina + p1MoveData.staminaRecovery);
  }
  if (p2MoveData.staminaCost) {
    match.p2Stamina = Math.max(0, match.p2Stamina - p2MoveData.staminaCost);
  }
  if (p2MoveData.staminaRecovery) {
    match.p2Stamina = Math.min(100, match.p2Stamina + p2MoveData.staminaRecovery);
  }

  if (p1MoveData.damage) {
    const staminaFactor = match.p1Stamina > 20 ? 1 : 0.5;
    const [min, max] = p1MoveData.damage;
    p1Damage = Math.floor((Math.random() * (max - min + 1) + min) * staminaFactor);
    
    if (p2Move === 'dodge' && Math.random() < MOVES.dodge.dodgeChance + getNftLuckBonus(match.player2)) {
      p1Damage = 0;
      p2Message = '💨 ¡Esquivó!';
      if (Math.random() < MOVES.dodge.counterChance) {
        p2Damage = Math.floor(Math.random() * 10) + 5;
        p2Message += ` ¡Contraataque: ${p2Damage}!`;
      }
    } else if (p2Move === 'block') {
      p1Damage = Math.floor(p1Damage * (1 - MOVES.block.damageReduction));
      p2Message = '🛡️ Bloqueó';
      if (Math.random() < MOVES.block.counterChance) {
        p2Damage = Math.floor(Math.random() * 8) + 3;
        p2Message += ` ¡Contra: ${p2Damage}!`;
      }
    }
    
    if (p1Damage > 0) {
      p1Message = `${p1MoveData.emoji} ${p1MoveData.name}: ${p1Damage} daño`;
      if (p1MoveData.koChance && Math.random() < p1MoveData.koChance + getNftLuckBonus(match.player1)) {
        p1Damage += 30;
        p1Message += ' ⚡KO POWER!';
      }
    }
  } else {
    p1Message = `${p1MoveData.emoji} ${p1MoveData.name}`;
  }

  if (p2MoveData.damage) {
    const staminaFactor = match.p2Stamina > 20 ? 1 : 0.5;
    const [min, max] = p2MoveData.damage;
    let baseDamage = Math.floor((Math.random() * (max - min + 1) + min) * staminaFactor);
    
    if (p1Move === 'dodge' && Math.random() < MOVES.dodge.dodgeChance + getNftLuckBonus(match.player1)) {
      baseDamage = 0;
      if (!p1Message.includes('Esquivó')) p1Message = '💨 ¡Esquivó!';
      if (Math.random() < MOVES.dodge.counterChance) {
        p1Damage += Math.floor(Math.random() * 10) + 5;
        p1Message += ` ¡Contra!`;
      }
    } else if (p1Move === 'block') {
      baseDamage = Math.floor(baseDamage * (1 - MOVES.block.damageReduction));
      if (!p1Message.includes('Bloqueó')) p1Message = '🛡️ Bloqueó';
    }
    
    if (baseDamage > 0) {
      if (!p2Message) p2Message = `${p2MoveData.emoji} ${p2MoveData.name}: ${baseDamage} daño`;
      if (p2MoveData.koChance && Math.random() < p2MoveData.koChance + getNftLuckBonus(match.player2)) {
        baseDamage += 30;
        p2Message += ' ⚡KO POWER!';
      }
      p2Damage += baseDamage;
    }
  } else if (!p2Message) {
    p2Message = `${p2MoveData.emoji} ${p2MoveData.name}`;
  }

  match.p2Hp = Math.max(0, match.p2Hp - p1Damage);
  match.p1Hp = Math.max(0, match.p1Hp - p2Damage);

  match.p1Stamina = Math.min(100, match.p1Stamina + 5);
  match.p2Stamina = Math.min(100, match.p2Stamina + 5);

  roundLog.p1 = { move: p1Move, damage: p1Damage, message: p1Message };
  roundLog.p2 = { move: p2Move, damage: p2Damage, message: p2Message };
  match.log.push(roundLog);

  match.p1Move = null;
  match.p2Move = null;
  match.round++;

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

  return roundLog;
}

function createHpBar(hp, max = 100) {
  const filled = Math.round((hp / max) * 10);
  const empty = 10 - filled;
  return `${'❤️'.repeat(Math.ceil(filled/2))}${'🖤'.repeat(Math.ceil(empty/2))} ${hp}`;
}

function createStaminaBar(stamina) {
  const filled = Math.round((stamina / 100) * 5);
  const empty = 5 - filled;
  return `${'⚡'.repeat(filled)}${'▫️'.repeat(empty)} ${stamina}`;
}

function createMatchEmbed(match, perspective) {
  const isP1 = perspective === match.player1;
  const yourHp = isP1 ? match.p1Hp : match.p2Hp;
  const theirHp = isP1 ? match.p2Hp : match.p1Hp;
  const yourStamina = isP1 ? match.p1Stamina : match.p2Stamina;
  const theirStamina = isP1 ? match.p2Stamina : match.p1Stamina;
  const opponent = isP1 ? match.player2 : match.player1;
  
  let description = `🥊 **BOXING LOS SANTOS** 🥊\n`;
  description += `**Round ${match.round}**\n\n`;
  description += `**Tú:**\n`;
  description += `HP: ${createHpBar(yourHp)}\n`;
  description += `ST: ${createStaminaBar(yourStamina)}\n\n`;
  description += `**<@${opponent}>:**\n`;
  description += `HP: ${createHpBar(theirHp)}\n`;
  description += `ST: ${createStaminaBar(theirStamina)}\n\n`;
  description += `💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()} c/u\n`;
  
  if (match.log.length > 0) {
    const lastRound = match.log[match.log.length - 1];
    description += `\n**Ronda anterior:**\n`;
    description += `• Tú: ${isP1 ? lastRound.p1.message : lastRound.p2.message}\n`;
    description += `• Rival: ${isP1 ? lastRound.p2.message : lastRound.p1.message}\n`;
  }
  
  const yourMove = isP1 ? match.p1Move : match.p2Move;
  if (yourMove) {
    description += `\n✅ Movimiento: **${MOVES[yourMove].name}**\n⏳ Esperando rival...`;
  }

  let color = 0xff6b00;
  if (match.state === 'finished') {
    if (match.winner === perspective) {
      color = 0x00ff00;
      description = `🏆 **¡VICTORIA POR KO!** 🏆\n\n` + description;
    } else if (match.winner === null) {
      color = 0xffff00;
      description = `🤝 **¡EMPATE TÉCNICO!** 🤝\n\n` + description;
    } else {
      color = 0xff0000;
      description = `💀 **¡KO!** 💀\n\n` + description;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🥊 BOXING LS 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Pelea como un campeón!'
  });
}

function createWaitingEmbed(match, userId) {
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🥊 BOXING LS 🍀`,
    description: `⏳ **Esperando oponente...**\n\n💰 **Apuesta:** ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}\n🏆 **Premio:** ${config.CURRENCY_SYMBOL} ${(match.stakes * 2).toLocaleString()}\n\n*Un retador debe aceptar el combate*`,
    color: 0xffaa00,
    footer: 'Emerald Isle Casino ® - ¡Prepárate para pelear!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🥊 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Movimientos:**\n`;
  description += `👊 Jab - Rápido, bajo daño\n`;
  description += `🥊 Hook - Medio, chance KO\n`;
  description += `💥 Uppercut - Alto daño, chance KO\n`;
  description += `🛡️ Bloquear - Reduce daño, recupera stamina\n`;
  description += `💨 Esquivar - Evita golpes, contraataque\n\n`;
  
  if (availableMatches.length > 0) {
    description += `**Peleas disponibles:**\n`;
    for (const m of availableMatches.slice(0, 3)) {
      description += `• <@${m.player1}> - ${config.CURRENCY_SYMBOL} ${m.stakes.toLocaleString()}\n`;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🥊 BOXING LS 🍀`,
    description,
    color: 0xff6b00,
    footer: 'Emerald Isle Casino ® - ¡Combate PvP con stamina!'
  });
}

function createMoveButtons(userId, stamina, disabled = false) {
  const canHeavy = stamina >= 20;
  const canUppercut = stamina >= 30;
  const canDodge = stamina >= 15;
  
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`boxing_jab_${userId}`).setLabel('👊 Jab').setStyle(ButtonStyle.Primary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`boxing_hook_${userId}`).setLabel('🥊 Hook').setStyle(ButtonStyle.Danger).setDisabled(disabled || !canHeavy),
      new ButtonBuilder().setCustomId(`boxing_uppercut_${userId}`).setLabel('💥 Uppercut').setStyle(ButtonStyle.Danger).setDisabled(disabled || !canUppercut)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`boxing_block_${userId}`).setLabel('🛡️ Bloquear').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`boxing_dodge_${userId}`).setLabel('💨 Esquivar').setStyle(ButtonStyle.Success).setDisabled(disabled || !canDodge)
    )
  ];
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_boxing') {
    await interaction.deferReply({ flags: 64 });
    
    const existingMatch = getMatch(userId);
    if (existingMatch && existingMatch.state === 'fighting') {
      const yourStamina = existingMatch.player1 === userId ? existingMatch.p1Stamina : existingMatch.p2Stamina;
      const yourMove = existingMatch.player1 === userId ? existingMatch.p1Move : existingMatch.p2Move;
      const embed = createMatchEmbed(existingMatch, userId);
      const buttons = createMoveButtons(userId, yourStamina, !!yourMove);
      return interaction.editReply({ embeds: [embed], components: buttons });
    }
    
    if (existingMatch && existingMatch.state === 'waiting') {
      const embed = createWaitingEmbed(existingMatch, userId);
      const buttons = [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`boxing_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
      )];
      return interaction.editReply({ embeds: [embed], components: buttons });
    }

    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const availableMatches = [...activeMatches.values()].filter(m => m.state === 'waiting' && m.player1 !== userId);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`boxing_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`boxing_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`boxing_create_${userId}`).setLabel('🥊 Crear Pelea').setStyle(ButtonStyle.Primary)
      )
    ];
    
    if (availableMatches.length > 0) {
      const joinButtons = availableMatches.slice(0, 3).map(m => 
        new ButtonBuilder().setCustomId(`boxing_join_${m.id}_${userId}`).setLabel(`Unirse ${config.CURRENCY_SYMBOL} ${m.stakes}`).setStyle(ButtonStyle.Success)
      );
      rows.push(new ActionRowBuilder().addComponents(joinButtons));
    }

    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('boxing_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`boxing_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`boxing_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`boxing_create_${userId}`).setLabel('🥊 Crear Pelea').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('boxing_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`boxing_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`boxing_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`boxing_create_${userId}`).setLabel('🥊 Crear Pelea').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('boxing_create_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    if (balance < setup.bet) {
      return interaction.followUp({ embeds: [errorEmbed(`Saldo insuficiente.`)], flags: 64 });
    }
    if (!economy.deductForBet(userId, setup.bet)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar apuesta.')], flags: 64 });
    }
    const match = createMatch(userId, setup.bet);
    setupState.delete(userId);
    const embed = createWaitingEmbed(match, userId);
    const buttons = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`boxing_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
    )];
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('boxing_join_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const matchId = `box_${parts[2]}_${parts[3]}`;
    const match = activeMatches.get(matchId);
    if (!match || match.state !== 'waiting') {
      return interaction.followUp({ embeds: [errorEmbed('Esta pelea ya no está disponible.')], flags: 64 });
    }
    const balance = economy.getBalance(userId);
    if (balance < match.stakes) {
      return interaction.followUp({ embeds: [errorEmbed(`Necesitas ${config.CURRENCY_SYMBOL} ${match.stakes.toLocaleString()}.`)], flags: 64 });
    }
    if (!economy.deductForBet(userId, match.stakes)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar apuesta.')], flags: 64 });
    }
    joinMatch(matchId, userId);
    const embed = createMatchEmbed(match, userId);
    const buttons = createMoveButtons(userId, 100);
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('boxing_cancel_')) {
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
      new ButtonBuilder().setCustomId(`boxing_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`boxing_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`boxing_create_${userId}`).setLabel('🥊 Crear Pelea').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  const moveTypes = ['jab', 'hook', 'uppercut', 'block', 'dodge'];
  for (const moveType of moveTypes) {
    if (customId.startsWith(`boxing_${moveType}_`)) {
      await interaction.deferUpdate();
      const match = getMatch(userId);
      if (!match || match.state !== 'fighting') {
        return interaction.followUp({ embeds: [errorEmbed('No tienes una pelea activa.')], flags: 64 });
      }
      
      if (match.player1 === userId) {
        if (match.p1Move) return;
        match.p1Move = moveType;
      } else {
        if (match.p2Move) return;
        match.p2Move = moveType;
      }

      if (match.p1Move && match.p2Move) {
        processRound(match);
        
        if (match.state === 'finished') {
          if (match.winner) {
            let prize = match.stakes * 2;
            prize = applyNftBonus(match.winner, prize, true);
            economy.addWinnings(match.winner, prize);
            updateStats(match.winner, 'boxing_ls', match.stakes, prize, true);
            const loser = match.winner === match.player1 ? match.player2 : match.player1;
            updateStats(loser, 'boxing_ls', match.stakes, 0, false);
            const drop = maybeDrop(match.winner, 'boxing_ls');
            if (drop) {
              try {
                await interaction.channel.send({
                  content: `<@${match.winner}>`,
                  embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)]
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

      const yourStamina = match.player1 === userId ? match.p1Stamina : match.p2Stamina;
      const yourMove = match.player1 === userId ? match.p1Move : match.p2Move;
      const embed = createMatchEmbed(match, userId);
      const buttons = createMoveButtons(userId, yourStamina, !!yourMove || match.state === 'finished');
      return interaction.editReply({ embeds: [embed], components: buttons });
    }
  }
}

module.exports = { handle };
