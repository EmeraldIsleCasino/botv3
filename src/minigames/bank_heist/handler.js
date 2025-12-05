const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../../utils/embedBuilder');
const economy = require('../../database/economy');
const { minigamesDb, updateStats } = require('../../database/minigames');
const { applyNftBonus, maybeDrop, getNftLuckBonus } = require('../../nfts/system/database');
const config = require('../../utils/config');

const activeHeists = new Map();
const setupState = new Map();

const ROLES = {
  leader: { name: 'Líder', emoji: '👔', bonus: 1.2, description: 'Coordina el equipo (+20% ganancias)' },
  hacker: { name: 'Hacker', emoji: '💻', bonus: 0.15, description: 'Desactiva alarmas (+15% éxito)' },
  driver: { name: 'Conductor', emoji: '🚗', bonus: 0.10, description: 'Escape rápido (+10% éxito)' },
  gunner: { name: 'Tirador', emoji: '🔫', bonus: 0.12, description: 'Protección (+12% éxito)' }
};

const EVENTS = [
  { name: 'Guardia dormido', emoji: '😴', effect: 'success', value: 0.15, chance: 0.12 },
  { name: 'Alarma silenciosa', emoji: '🚨', effect: 'fail', value: 0.20, chance: 0.10 },
  { name: 'Bóveda extra', emoji: '💰', effect: 'loot', value: 1.5, chance: 0.08 },
  { name: 'Cámaras offline', emoji: '📹', effect: 'success', value: 0.10, chance: 0.15 },
  { name: 'Policía cerca', emoji: '👮', effect: 'fail', value: 0.15, chance: 0.12 },
  { name: 'Información privilegiada', emoji: '📋', effect: 'success', value: 0.20, chance: 0.06 }
];

function createHeist(leaderId, stakes) {
  const heistId = `heist_${leaderId}_${Date.now()}`;
  const heist = {
    id: heistId,
    leader: leaderId,
    stakes,
    roles: { leader: leaderId, hacker: null, driver: null, gunner: null },
    ready: { [leaderId]: true },
    stage: 'recruiting',
    events: [],
    success: null,
    loot: 0,
    createdAt: Date.now()
  };
  activeHeists.set(heistId, heist);
  return heist;
}

function joinHeist(heistId, userId, role) {
  const heist = activeHeists.get(heistId);
  if (!heist || heist.stage !== 'recruiting') return null;
  if (heist.roles[role] !== null) return null;
  if (Object.values(heist.roles).includes(userId)) return null;
  
  heist.roles[role] = userId;
  heist.ready[userId] = false;
  return heist;
}

function setReady(heistId, userId) {
  const heist = activeHeists.get(heistId);
  if (!heist) return null;
  heist.ready[userId] = true;
  return heist;
}

function getHeist(userId) {
  for (const [id, heist] of activeHeists) {
    if (Object.values(heist.roles).includes(userId)) {
      return heist;
    }
  }
  return null;
}

function deleteHeist(heistId) {
  activeHeists.delete(heistId);
}

function isTeamReady(heist) {
  const filledRoles = Object.values(heist.roles).filter(r => r !== null);
  return filledRoles.length >= 2 && filledRoles.every(userId => heist.ready[userId]);
}

function executeHeist(heist) {
  let baseSuccess = 0.40;
  let lootMultiplier = 1.0;
  const events = [];

  for (const [role, userId] of Object.entries(heist.roles)) {
    if (userId && role !== 'leader') {
      baseSuccess += ROLES[role].bonus;
      const luckBonus = getNftLuckBonus(userId);
      baseSuccess += luckBonus * 0.5;
    }
  }

  for (const event of EVENTS) {
    if (Math.random() < event.chance) {
      events.push(event);
      if (event.effect === 'success') {
        baseSuccess += event.value;
      } else if (event.effect === 'fail') {
        baseSuccess -= event.value;
      } else if (event.effect === 'loot') {
        lootMultiplier *= event.value;
      }
    }
  }

  baseSuccess = Math.max(0.05, Math.min(0.95, baseSuccess));
  const success = Math.random() < baseSuccess;

  let totalLoot = 0;
  if (success) {
    const participantCount = Object.values(heist.roles).filter(r => r !== null).length;
    const baseLoot = heist.stakes * participantCount * 2;
    totalLoot = Math.floor(baseLoot * lootMultiplier);
  }

  heist.events = events;
  heist.success = success;
  heist.loot = totalLoot;
  heist.stage = 'finished';

  return { success, loot: totalLoot, events, successChance: baseSuccess };
}

function distributeLoot(heist) {
  if (!heist.success) return {};
  
  const distribution = {};
  const participants = Object.entries(heist.roles).filter(([_, id]) => id !== null);
  const baseSplit = heist.loot / participants.length;

  for (const [role, userId] of participants) {
    let share = baseSplit;
    if (role === 'leader') {
      share *= ROLES.leader.bonus;
    }
    share = Math.floor(applyNftBonus(userId, share, true));
    distribution[userId] = { role, share };
    economy.addWinnings(userId, share);
    updateStats(userId, 'bank_heist', heist.stakes, share, true);
  }

  return distribution;
}

function createRecruitingEmbed(heist) {
  let description = `🔫 **BANK HEIST** 🔫\n\n`;
  description += `**Estado:** Reclutando equipo\n`;
  description += `💰 **Apuesta por persona:** ${config.CURRENCY_SYMBOL} ${heist.stakes.toLocaleString()}\n\n`;
  description += `**Equipo:**\n`;
  
  for (const [role, userId] of Object.entries(heist.roles)) {
    const roleData = ROLES[role];
    const status = userId ? (heist.ready[userId] ? '✅' : '⏳') : '❌';
    const user = userId ? `<@${userId}>` : '*Vacante*';
    description += `${roleData.emoji} **${roleData.name}:** ${user} ${status}\n`;
    description += `   └ ${roleData.description}\n`;
  }
  
  description += `\n*Se necesitan mínimo 2 personas para iniciar*`;

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🔫 BANK HEIST 🍀`,
    description,
    color: 0x2c3e50,
    footer: 'Emerald Isle Casino ® - ¡Planea el golpe perfecto!'
  });
}

function createResultEmbed(heist, distribution) {
  let description = `🔫 **BANK HEIST** 🔫\n\n`;
  
  if (heist.events.length > 0) {
    description += `**Eventos durante el atraco:**\n`;
    for (const event of heist.events) {
      description += `${event.emoji} ${event.name}\n`;
    }
    description += `\n`;
  }
  
  if (heist.success) {
    description += `🎉 **¡ÉXITO!** 🎉\n\n`;
    description += `💰 **Botín total:** ${config.CURRENCY_SYMBOL} ${heist.loot.toLocaleString()}\n\n`;
    description += `**Reparto:**\n`;
    for (const [userId, data] of Object.entries(distribution)) {
      description += `${ROLES[data.role].emoji} <@${userId}>: ${config.CURRENCY_SYMBOL} ${data.share.toLocaleString()}\n`;
    }
  } else {
    description += `💀 **¡FRACASO!** 💀\n\n`;
    description += `El atraco falló. Todos perdieron su apuesta.\n`;
    description += `💸 **Pérdida total:** ${config.CURRENCY_SYMBOL} ${(heist.stakes * Object.values(heist.roles).filter(r => r !== null).length).toLocaleString()}`;
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🔫 RESULTADO 🍀`,
    description,
    color: heist.success ? 0x27ae60 : 0xe74c3c,
    footer: 'Emerald Isle Casino ® - ¡El crimen no paga... o sí!'
  });
}

function createSetupEmbed(userId, bet) {
  const balance = economy.getBalance(userId);
  const availableHeists = [...activeHeists.values()].filter(h => 
    h.stage === 'recruiting' && 
    !Object.values(h.roles).includes(userId) &&
    Object.values(h.roles).some(r => r === null)
  );
  
  let description = `💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n`;
  description += `🔫 **Apuesta:** ${config.CURRENCY_SYMBOL} ${bet.toLocaleString()}\n\n`;
  description += `**Roles disponibles:**\n`;
  for (const [role, data] of Object.entries(ROLES)) {
    description += `${data.emoji} **${data.name}** - ${data.description}\n`;
  }
  
  if (availableHeists.length > 0) {
    description += `\n**Atracos disponibles:**\n`;
    for (const h of availableHeists.slice(0, 3)) {
      const slots = Object.values(h.roles).filter(r => r === null).length;
      description += `• <@${h.leader}> - ${config.CURRENCY_SYMBOL} ${h.stakes.toLocaleString()} (${slots} slots)\n`;
    }
  }

  return createEmbed({
    title: `🍀 ${config.CASINO_NAME} - 🔫 BANK HEIST 🍀`,
    description,
    color: 0x2c3e50,
    footer: 'Emerald Isle Casino ® - ¡Atraco cooperativo!'
  });
}

function createRoleButtons(heistId, userId, heist) {
  const availableRoles = Object.entries(heist.roles)
    .filter(([_, id]) => id === null)
    .map(([role, _]) => role);
  
  const buttons = availableRoles.map(role => 
    new ButtonBuilder()
      .setCustomId(`heist_join_${heistId}_${role}_${userId}`)
      .setLabel(`${ROLES[role].emoji} ${ROLES[role].name}`)
      .setStyle(ButtonStyle.Primary)
  );
  
  if (buttons.length === 0) return [];
  return [new ActionRowBuilder().addComponents(buttons.slice(0, 4))];
}

async function handle(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId === 'mg_heist') {
    await interaction.deferReply({ flags: 64 });
    
    const existingHeist = getHeist(userId);
    if (existingHeist && existingHeist.stage === 'recruiting') {
      const embed = createRecruitingEmbed(existingHeist);
      const buttons = [];
      
      if (!existingHeist.ready[userId]) {
        buttons.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`heist_ready_${existingHeist.id}_${userId}`).setLabel('✅ Listo').setStyle(ButtonStyle.Success)
        ));
      }
      
      if (existingHeist.leader === userId) {
        const canStart = isTeamReady(existingHeist);
        buttons.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`heist_start_${existingHeist.id}_${userId}`).setLabel('🚨 INICIAR ATRACO').setStyle(ButtonStyle.Danger).setDisabled(!canStart),
          new ButtonBuilder().setCustomId(`heist_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
        ));
      }
      
      return interaction.editReply({ embeds: [embed], components: buttons });
    }

    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    
    const availableHeists = [...activeHeists.values()].filter(h => 
      h.stage === 'recruiting' && 
      !Object.values(h.roles).includes(userId) &&
      Object.values(h.roles).some(r => r === null)
    );
    
    const rows = [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`heist_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`heist_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`heist_create_${userId}`).setLabel('🔫 Crear Atraco').setStyle(ButtonStyle.Primary)
      )
    ];
    
    if (availableHeists.length > 0) {
      for (const h of availableHeists.slice(0, 2)) {
        const roleButtons = createRoleButtons(h.id, userId, h);
        rows.push(...roleButtons);
      }
    }

    return interaction.editReply({ embeds: [embed], components: rows.slice(0, 5) });
  }

  if (customId.startsWith('heist_bet_down_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    setup.bet = Math.max(100, setup.bet - 100);
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`heist_create_${userId}`).setLabel('🔫 Crear Atraco').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('heist_bet_up_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    setup.bet = Math.min(balance, Math.min(10000, setup.bet + 100));
    setupState.set(userId, setup);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`heist_create_${userId}`).setLabel('🔫 Crear Atraco').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }

  if (customId.startsWith('heist_create_')) {
    await interaction.deferUpdate();
    const setup = setupState.get(userId) || { bet: 500 };
    const balance = economy.getBalance(userId);
    if (balance < setup.bet) {
      return interaction.followUp({ embeds: [errorEmbed('Saldo insuficiente.')], flags: 64 });
    }
    if (!economy.deductForBet(userId, setup.bet)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar.')], flags: 64 });
    }
    const heist = createHeist(userId, setup.bet);
    setupState.delete(userId);
    
    const embed = createRecruitingEmbed(heist);
    const buttons = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Danger)
    )];
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('heist_join_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const heistId = `heist_${parts[2]}_${parts[3]}`;
    const role = parts[4];
    
    const heist = activeHeists.get(heistId);
    if (!heist || heist.stage !== 'recruiting') {
      return interaction.followUp({ embeds: [errorEmbed('Atraco no disponible.')], flags: 64 });
    }
    
    const balance = economy.getBalance(userId);
    if (balance < heist.stakes) {
      return interaction.followUp({ embeds: [errorEmbed(`Necesitas ${config.CURRENCY_SYMBOL} ${heist.stakes.toLocaleString()}.`)], flags: 64 });
    }
    if (!economy.deductForBet(userId, heist.stakes)) {
      return interaction.followUp({ embeds: [errorEmbed('Error al procesar.')], flags: 64 });
    }
    
    joinHeist(heistId, userId, role);
    
    const embed = createRecruitingEmbed(heist);
    const buttons = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_ready_${heistId}_${userId}`).setLabel('✅ Listo').setStyle(ButtonStyle.Success)
    )];
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('heist_ready_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const heistId = `heist_${parts[2]}_${parts[3]}`;
    
    const heist = activeHeists.get(heistId);
    if (!heist) return;
    
    setReady(heistId, userId);
    
    const embed = createRecruitingEmbed(heist);
    const buttons = [];
    
    if (heist.leader === userId && isTeamReady(heist)) {
      buttons.push(new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`heist_start_${heistId}_${userId}`).setLabel('🚨 INICIAR ATRACO').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`heist_cancel_${userId}`).setLabel('❌ Cancelar').setStyle(ButtonStyle.Secondary)
      ));
    }
    
    return interaction.editReply({ embeds: [embed], components: buttons });
  }

  if (customId.startsWith('heist_start_')) {
    await interaction.deferUpdate();
    const parts = customId.split('_');
    const heistId = `heist_${parts[2]}_${parts[3]}`;
    
    const heist = activeHeists.get(heistId);
    if (!heist || heist.leader !== userId) return;
    
    const result = executeHeist(heist);
    let distribution = {};
    
    if (heist.success) {
      distribution = distributeLoot(heist);
      const drop = maybeDrop(userId, 'bank_heist');
      if (drop) {
        try {
          await interaction.channel.send({
            content: `<@${userId}>`,
            embeds: [successEmbed(`🎁 ¡NFT! **${drop.name}** (${drop.rarity})`)]
          });
        } catch (e) {}
      }
    } else {
      for (const [_, odUserId] of Object.entries(heist.roles)) {
        if (odUserId) {
          updateStats(odUserId, 'bank_heist', heist.stakes, 0, false);
        }
      }
    }
    
    const embed = createResultEmbed(heist, distribution);
    deleteHeist(heistId);
    
    return interaction.editReply({ embeds: [embed], components: [] });
  }

  if (customId.startsWith('heist_cancel_')) {
    await interaction.deferUpdate();
    const heist = getHeist(userId);
    if (heist && heist.leader === userId && heist.stage === 'recruiting') {
      for (const [_, odUserId] of Object.entries(heist.roles)) {
        if (odUserId) {
          economy.addWinnings(odUserId, heist.stakes);
        }
      }
      deleteHeist(heist.id);
    }
    
    setupState.set(userId, { bet: 500 });
    const setup = setupState.get(userId);
    const embed = createSetupEmbed(userId, setup.bet);
    const rows = [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`heist_bet_down_${userId}`).setLabel('➖ $100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`heist_bet_up_${userId}`).setLabel('➕ $100').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`heist_create_${userId}`).setLabel('🔫 Crear Atraco').setStyle(ButtonStyle.Primary)
    )];
    return interaction.editReply({ embeds: [embed], components: rows });
  }
}

module.exports = { handle };
