const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeRaces = new Map();
const userBets = new Map();
const setupState = new Map();

const DUCKS = [
  { name: 'Quacky', emoji: '🦆', color: '🟡', odds: 2.0 },
  { name: 'Ducktor', emoji: '🦆', color: '🔵', odds: 3.0 },
  { name: 'Waddles', emoji: '🦆', color: '🟢', odds: 4.0 },
  { name: 'Feathers', emoji: '🦆', color: '🟣', odds: 5.0 },
  { name: 'Splash', emoji: '🦆', color: '🟠', odds: 6.0 },
  { name: 'Bubbles', emoji: '🦆', color: '🔴', odds: 8.0 }
];

const OBSTACLES = [
  { name: 'Corriente favorable', emoji: '💨', effect: 'boost', value: 3 },
  { name: 'Remolino', emoji: '🌀', effect: 'slow', value: 2 },
  { name: 'Pez saltarín', emoji: '🐟', effect: 'random', value: 0 },
  { name: 'Ola grande', emoji: '🌊', effect: 'shuffle', value: 0 },
  { name: 'Alga enredada', emoji: '🌿', effect: 'slow', value: 1 }
];

function createRace(channelId) {
  const raceId = `race_${channelId}_${Date.now()}`;
  const race = {
    id: raceId,
    channelId,
    ducks: DUCKS.map((d, i) => ({ ...d, index: i, position: 0 })),
    bets: [],
    status: 'betting',
    winner: null,
    createdAt: Date.now()
  };
  activeRaces.set(raceId, race);
  return race;
}

function getActiveRace(channelId) {
  for (const [id, race] of activeRaces) {
    if (race.channelId === channelId && race.status === 'betting') {
      return race;
    }
  }
  return null;
}

function addBet(raceId, userId, duckIndex, amount) {
  const race = activeRaces.get(raceId);
  if (!race || race.status !== 'betting') return null;
  
  const existingBet = race.bets.find(b => b.userId === userId);
  if (existingBet) return null;
  
  const duck = race.ducks[duckIndex];
  race.bets.push({
    userId,
    duckIndex,
    amount,
    odds: duck.odds
  });
  
  userBets.set(`${userId}_${raceId}`, { duckIndex, amount, odds: duck.odds });
  return race;
}

function runRace(race) {
  const trackLength = 20;
  const frames = [];
  
  while (!race.ducks.some(d => d.position >= trackLength)) {
    const frame = { positions: [], events: [] };
    
    for (const duck of race.ducks) {
      let move = Math.floor(Math.random() * 3) + 1;
      
      if (Math.random() < 0.15) {
        const obstacle = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
        frame.events.push({ duck: duck.index, obstacle });
        
        if (obstacle.effect === 'boost') {
          move += obstacle.value;
        } else if (obstacle.effect === 'slow') {
          move = Math.max(0, move - obstacle.value);
        } else if (obstacle.effect === 'shuffle') {
          move = Math.floor(Math.random() * 5);
        }
      }
      
      duck.position = Math.min(trackLength, duck.position + move);
    }
    
    frame.positions = race.ducks.map(d => d.position);
    frames.push(frame);
    
    if (race.ducks.some(d => d.position >= trackLength)) break;
  }
  
  const maxPos = Math.max(...race.ducks.map(d => d.position));
  const winners = race.ducks.filter(d => d.position >= maxPos);
  race.winner = winners[0].index;
  race.status = 'finished';
  race.frames = frames;
  
  return race;
}

function createTrackDisplay(race, frame = null) {
  const trackLength = 20;
  let display = '';
  
  for (const duck of race.ducks) {
    const pos = frame !== null ? frame.positions[duck.index] : duck.position;
    const normalizedPos = Math.floor((pos / trackLength) * 15);
    
    let track = duck.color + ' ';
    for (let i = 0; i < 15; i++) {
      if (i === normalizedPos) {
        track += duck.emoji;
      } else if (i < normalizedPos) {
        track += '─';
      } else {
        track += '░';
      }
    }
    track += ' 🏁';
    display += `${track} ${duck.name}\n`;
  }
  
  return display;
}

function createBettingEmbed(race) {
  let description = `🦆 **DUCK RACE** 🦆\n\n`;
  description += `**Selecciona un pato para apostar:**\n\n`;
  
  for (const duck of race.ducks) {
    description += `${duck.color} ${duck.emoji} **${duck.name}** - Cuota: \`${duck.odds.toFixed(1)}x\`\n`;
  }
  
  description += `\n📊 **Apuestas actuales:** ${race.bets.length}\n`;
  description += `💰 **Pozo total:** ${config.CURRENCY_SYMBOL} ${race.bets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}\n`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🦆 DUCK RACE 🍀`,
    description,
    color: 0xf1c40f,
    footer: 'Emerald Isle Casino ® - ¡Apuesta por tu pato!'
  });
}

function createRaceEmbed(race, status = 'racing', currentFrame = null) {
  let trackDisplay = currentFrame ? createTrackDisplay(race, currentFrame) : createTrackDisplay(race);
  
  let description = `🦆 **DUCK RACE** 🦆\n\n`;
  description += `\`\`\`\n${trackDisplay}\`\`\`\n`;
  
  if (currentFrame && currentFrame.events.length > 0) {
    description += `**Eventos:**\n`;
    for (const event of currentFrame.events) {
      const duck = race.ducks[event.duck];
      description += `${event.obstacle.emoji} ${duck.name}: ${event.obstacle.name}\n`;
    }
  }
  
  let color = 0xf1c40f;
  
  if (status === 'finished' && race.winner !== null) {
    const winnerDuck = race.ducks[race.winner];
    color = 0x27ae60;
    description += `\n🏆 **¡${winnerDuck.name} GANA!** 🏆\n`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🦆 ${status === 'finished' ? 'RESULTADO' : 'CARRERA'} 🍀`,
    description,
    color,
    footer: 'Emerald Isle Casino ® - ¡Quack quack!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🎲 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Patos disponibles:**\n`;
  for (const duck of DUCKS) {
    description += `${duck.color} ${duck.emoji} **${duck.name}** - Cuota: \`${duck.odds}x\`\n`;
  }
  description += `\n*Mayor cuota = menos probable pero más ganancia*`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🦆 DUCK RACE 🍀`,
    description,
    color: 0xf1c40f,
    footer: 'Emerald Isle Casino ® - ¡Carrera de patos!'
  });
}

function createDuckButtons(userId, bet) {
  const buttons = DUCKS.map((duck, i) => 
    new ButtonBuilder()
      .setCustomId(`duck_bet_${i}_${bet}_${userId}`)
      .setLabel(`${duck.name}`)
      .setEmoji(duck.color.slice(0, 2))
      .setStyle(ButtonStyle.Primary)
  );
  
  return [
    new ActionRowBuilder().addComponents(buttons.slice(0, 3)),
    new ActionRowBuilder().addComponents(buttons.slice(3, 6))
  ];
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_duck') {
    await interaction.deferReply({ flags: 64 });
    
    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duck_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duck_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duck_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
      ),
      ...createDuckButtons(userId, setup.bet)
    ];

    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duck_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duck_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duck_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duck_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
      ),
      ...createDuckButtons(userId, setup.bet)
    ];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duck_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duck_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duck_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duck_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
      ),
      ...createDuckButtons(userId, setup.bet)
    ];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('duck_bet_max_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 100 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, 10000);
    setupState.set(userId, setup);
    
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duck_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duck_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duck_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
      ),
      ...createDuckButtons(userId, setup.bet)
    ];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.match(/^duck_bet_\d+_\d+_/)) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const duckIndex = parseInt(parts[2]);
    const bet = parseInt(parts[3]);
    
    const balance = economy.getBalance(userId);
    if (balance < bet) {
      return interaction.followUp({
        embeds: [errorEmbed(`Saldo insuficiente.`)],
        flags: 64
      });
    }

    if (!economy.deductForBet(userId, bet)) {
      return interaction.followUp({
        embeds: [errorEmbed('Error al procesar apuesta.')],
        flags: 64
      });
    }

    const duck = DUCKS[duckIndex];
    const race = createRace(userId);
    addBet(race.id, userId, duckIndex, bet);

    await interaction.editReply({
      embeds: [createEmbed({
        title: `🍀 ${config.CASINO_NAME} - 🦆 DUCK RACE 🍀`,
        description: `🎲 **Apostaste ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}** a **${duck.name}**!\n\n🦆 *Preparando carrera...*`,
        color: 0xf1c40f
      })],
      components: []
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    runRace(race);

    for (let i = 0; i < Math.min(race.frames.length, 5); i++) {
      const frameIndex = Math.floor(i * race.frames.length / 5);
      const frame = race.frames[frameIndex];
      const embed = createRaceEmbed(race, 'racing', frame);
      await interaction.editReply({ embeds: [embed], components: [] });
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    const betInfo = userBets.get(`${userId}_${race.id}`);
    const won = race.winner === duckIndex;
    let payout = 0;

    if (won) {
      payout = Math.floor(bet * duck.odds);
      payout = applyNftBonus(userId, payout, true);
      economy.addWinnings(userId, payout);
      updateStats(userId, 'duck_race', bet, payout, true);
    } else {
      updateStats(userId, 'duck_race', bet, 0, false);
    }

    const drop = won ? maybeDrop(userId, 'duck_race') : null;

    const winnerDuck = DUCKS[race.winner];
    let resultDesc = createTrackDisplay(race);
    resultDesc = `\`\`\`\n${resultDesc}\`\`\`\n`;
    resultDesc += `🏆 **Ganador:** ${winnerDuck.color} ${winnerDuck.name}\n\n`;
    resultDesc += `Tu apuesta: ${duck.color} ${duck.name}\n`;
    
    if (won) {
      resultDesc += `\n🎉 **¡GANASTE ${config.CURRENCY_SYMBOL} ${payout.toLocaleString()}!**`;
    } else {
      resultDesc += `\n❌ **Perdiste ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}**`;
    }

    const resultEmbed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🦆 RESULTADO 🍀`,
      description: resultDesc,
      color: won ? 0x27ae60 : 0xe74c3c,
      footer: 'Emerald Isle Casino ® - ¡Quack quack!'
    });

    const buttons = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`duck_newrace_${userId}`).setLabel('🦆 Nueva Carrera').setStyle(ButtonStyle.Primary)
    )];

    activeRaces.delete(race.id);
    userBets.delete(`${userId}_${race.id}`);

    await interaction.editReply({ embeds: [resultEmbed], components: buttons });

    if (drop) {
      await interaction.followUp({
        embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)],
        flags: 64
      });
    }
  }

  if (customId.startsWith('duck_newrace_')) {
    await interaction.deferUpdate();
    
    setupState.set(userId, { bet: 100 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`duck_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`duck_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`duck_bet_max_${userId}`).setLabel('MAX').setStyle(ButtonStyle.Primary)
      ),
      ...createDuckButtons(userId, setup.bet)
    ];

    return interaction.editReply({ embeds: [embed], components: rows });
  }
}

module.exports = { handle };
