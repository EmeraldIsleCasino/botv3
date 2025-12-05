const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop } = require('../../nfts/system/database');
const config = require('../../utils/config');

const ROOMS = {
  small: { name: 'Small', min: 100, max: 1000, emoji: '🥉', color: 0xcd7f32 },
  medium: { name: 'Medium', min: 500, max: 5000, emoji: '🥈', color: 0xc0c0c0 },
  high: { name: 'High Rollers', min: 2000, max: 20000, emoji: '🥇', color: 0xffd700 }
};

const activePots = new Map();
const userBets = new Map();

function getPot(room) {
  if (!activePots.has(room)) {
    activePots.set(room, {
      room,
      entries: [],
      totalBet: 0,
      status: 'open',
      timer: null,
      countdown: 30
    });
  }
  return activePots.get(room);
}

function addEntry(room, userId, amount) {
  const pot = getPot(room);
  const ticketFrom = pot.totalBet;
  const ticketTo = pot.totalBet + amount - 1;
  
  pot.entries.push({ userId, amount, ticketFrom, ticketTo });
  pot.totalBet += amount;
  
  const userKey = `${userId}_${room}`;
  const existing = userBets.get(userKey) || 0;
  userBets.set(userKey, existing + amount);
  
  return { ticketFrom, ticketTo, totalBet: pot.totalBet };
}

function getUserChance(room, userId) {
  const pot = getPot(room);
  const userKey = `${userId}_${room}`;
  const userTotal = userBets.get(userKey) || 0;
  if (pot.totalBet === 0) return 0;
  return (userTotal / pot.totalBet * 100).toFixed(2);
}

function selectWinner(room) {
  const pot = getPot(room);
  if (pot.entries.length === 0) return null;
  
  const winningTicket = Math.floor(Math.random() * pot.totalBet);
  
  for (const entry of pot.entries) {
    if (winningTicket >= entry.ticketFrom && winningTicket <= entry.ticketTo) {
      return entry.userId;
    }
  }
  
  return pot.entries[0].userId;
}

function resetPot(room) {
  const pot = getPot(room);
  if (pot.timer) clearTimeout(pot.timer);
  
  for (const entry of pot.entries) {
    const userKey = `${entry.userId}_${room}`;
    userBets.delete(userKey);
  }
  
  activePots.set(room, {
    room,
    entries: [],
    totalBet: 0,
    status: 'open',
    timer: null,
    countdown: 30
  });
}

function createRoomSelectEmbed(userId) {
  const balance = economy.getBalance(userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n\n`;
  description += `Selecciona una sala para unirte al jackpot.\n`;
  description += `El ganador se lleva todo el pozo acumulado.\n\n`;
  
  for (const [key, room] of Object.entries(ROOMS)) {
    const pot = getPot(key);
    description += `${room.emoji} **${room.name}**\n`;
    description += `├ Apuesta: ${config.CURRENCY_SYMBOL} ${room.min.toLocaleString()} - ${room.max.toLocaleString()}\n`;
    description += `├ Pozo actual: ${config.CURRENCY_SYMBOL} ${pot.totalBet.toLocaleString()}\n`;
    description += `└ Jugadores: ${pot.entries.length}\n\n`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 💰 JACKPOT ROOMS 🍀`,
    description,
    color: 0x50c878,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createRoomEmbed(room, userId) {
  const roomInfo = ROOMS[room];
  const pot = getPot(room);
  const balance = economy.getBalance(userId);
  const userChance = getUserChance(room, userId);
  
  let description = `${roomInfo.emoji} **Sala ${roomInfo.name}**\n\n`;
  description += `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🎰 **Pozo actual:** ${config.CURRENCY_SYMBOL} ${pot.totalBet.toLocaleString()}\n`;
  description += `👥 **Jugadores:** ${pot.entries.length}\n`;
  description += `📊 **Tu probabilidad:** ${userChance}%\n\n`;
  description += `**Apuestas:**\n`;
  description += `├ Mínima: ${config.CURRENCY_SYMBOL} ${roomInfo.min.toLocaleString()}\n`;
  description += `└ Máxima: ${config.CURRENCY_SYMBOL} ${roomInfo.max.toLocaleString()}\n\n`;
  
  if (pot.entries.length > 0) {
    description += `**Participantes:**\n`;
    const uniqueUsers = [...new Set(pot.entries.map(e => e.userId))];
    for (const uid of uniqueUsers.slice(0, 5)) {
      const userKey = `${uid}_${room}`;
      const userTotal = userBets.get(userKey) || 0;
      const chance = (userTotal / pot.totalBet * 100).toFixed(1);
      description += `• <@${uid}>: ${config.CURRENCY_SYMBOL} ${userTotal.toLocaleString()} (${chance}%)\n`;
    }
    if (uniqueUsers.length > 5) {
      description += `*...y ${uniqueUsers.length - 5} más*\n`;
    }
  }
  
  if (pot.countdown < 30 && pot.entries.length >= 2) {
    description += `\n⏱️ **Tiempo restante:** ${pot.countdown} segundos`;
  } else if (pot.entries.length < 2) {
    description += `\n*Esperando más jugadores...*`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 💰 JACKPOT ${roomInfo.name.toUpperCase()} 🍀`,
    description,
    color: roomInfo.color,
    footer: 'Emerald Isle Casino ® - El ganador se lleva todo'
  });
}

function createWinnerEmbed(room, winnerId, prize) {
  const roomInfo = ROOMS[room];
  
  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🎉 JACKPOT WINNER! 🍀`,
    description: `${roomInfo.emoji} **Sala ${roomInfo.name}**\n\n🏆 **¡GANADOR!**\n<@${winnerId}>\n\n💰 **Premio:** ${config.CURRENCY_SYMBOL} ${prize.toLocaleString()}\n\n*¡Felicitaciones!*`,
    color: 0x00ff00,
    footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
  });
}

function createRoomButtons(room, userId) {
  const roomInfo = ROOMS[room];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`jackpot_bet_min_${room}_${userId}`).setLabel(`Apostar ${config.CURRENCY_SYMBOL} ${roomInfo.min}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`jackpot_bet_mid_${room}_${userId}`).setLabel(`Apostar ${config.CURRENCY_SYMBOL} ${Math.floor((roomInfo.min + roomInfo.max) / 2)}`).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`jackpot_bet_max_${room}_${userId}`).setLabel(`Apostar ${config.CURRENCY_SYMBOL} ${roomInfo.max}`).setStyle(ButtonStyle.Success)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`jackpot_refresh_${room}_${userId}`).setLabel('🔄 Actualizar').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`jackpot_back_${userId}`).setLabel('🔙 Volver').setStyle(ButtonStyle.Secondary)
    )
  ];
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_jackpot') {
    await interaction.deferReply({ flags: 64 });
    
    const embed = createRoomSelectEmbed(userId);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`jackpot_room_small_${userId}`).setLabel('🥉 Small').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`jackpot_room_medium_${userId}`).setLabel('🥈 Medium').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`jackpot_room_high_${userId}`).setLabel('🥇 High Rollers').setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }

  if (customId.startsWith('jackpot_room_')) {
    await interaction.deferUpdate();
    const room = customId.split('_')[2];
    
    const embed = createRoomEmbed(room, userId);
    const buttons = createRoomButtons(room, userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('jackpot_bet_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const betType = parts[2];
    const room = parts[3];
    const roomInfo = ROOMS[room];
    
    let amount;
    if (betType === 'min') amount = roomInfo.min;
    else if (betType === 'mid') amount = Math.floor((roomInfo.min + roomInfo.max) / 2);
    else amount = roomInfo.max;
    
    const balance = economy.getBalance(userId);
    if (balance < amount) {
      return interaction.followUp({
        embeds: [errorEmbed(`Saldo insuficiente. Tienes ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`)],
        flags: 64
      });
    }

    if (!economy.deductForBet(userId, amount)) {
      return interaction.followUp({
        embeds: [errorEmbed('No se pudo procesar la apuesta.')],
        flags: 64
      });
    }

    const result = addEntry(room, userId, amount);
    const pot = getPot(room);
    
    if (pot.entries.length >= 2 && !pot.timer) {
      pot.countdown = 30;
      startCountdown(room, interaction);
    }

    const embed = createRoomEmbed(room, userId);
    const buttons = createRoomButtons(room, userId);

    await interaction.editReply({ embeds: [embed], components: buttons });
    
    return interaction.followUp({
      embeds: [successEmbed(`¡Apostaste ${config.CURRENCY_SYMBOL} ${amount.toLocaleString()}! Tu probabilidad: ${getUserChance(room, userId)}%`)],
      flags: 64
    });
  }

  if (customId.startsWith('jackpot_refresh_')) {
    await interaction.deferUpdate();
    const room = customId.split('_')[2];
    
    const embed = createRoomEmbed(room, userId);
    const buttons = createRoomButtons(room, userId);

    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('jackpot_back_')) {
    await interaction.deferUpdate();
    
    const embed = createRoomSelectEmbed(userId);
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`jackpot_room_small_${userId}`).setLabel('🥉 Small').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`jackpot_room_medium_${userId}`).setLabel('🥈 Medium').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`jackpot_room_high_${userId}`).setLabel('🥇 High Rollers').setStyle(ButtonStyle.Success)
    );

    return interaction.editReply({ embeds: [embed], components: [buttons] });
  }
}

async function startCountdown(room, interaction) {
  const pot = getPot(room);
  
  pot.timer = setInterval(async () => {
    pot.countdown--;
    
    if (pot.countdown <= 0) {
      clearInterval(pot.timer);
      pot.timer = null;
      
      const winnerId = selectWinner(room);
      if (winnerId) {
        let prize = pot.totalBet;
        prize = applyNftBonus(winnerId, prize, true);
        
        economy.addWinnings(winnerId, prize);
        updateStats(winnerId, 'jackpot', 0, prize, true);
        
        for (const entry of pot.entries) {
          if (entry.userId !== winnerId) {
            updateStats(entry.userId, 'jackpot', entry.amount, 0, false);
          }
        }

        const drop = maybeDrop(winnerId, 'jackpot');
        
        try {
          const winEmbed = createWinnerEmbed(room, winnerId, prize);
          await interaction.channel.send({ embeds: [winEmbed] });
          
          if (drop) {
            await interaction.channel.send({
              content: `<@${winnerId}>`,
              embeds: [successEmbed(`🎁 ¡Bonus! Obtuviste una carta NFT: **${drop.name}** (${drop.rarity})`)]
            });
          }
        } catch (e) {
          console.error('[Jackpot] Error sending winner message:', e);
        }
      }
      
      resetPot(room);
    }
  }, 1000);
}

module.exports = { handle };
