const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');
const economy = require('../database/economy');
const giveaways = require('../database/giveaways');
const sports = require('../database/sports');
const insidetrack = require('../database/insidetrack');
const memberships = require('../database/memberships');
const { getDailyStats } = require('../database/dailyRewards');
const { getLogStats } = require('../database/logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Panel administrativo completo del casino (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const dashboardData = await collectDashboardData();

      const embed = createMainDashboardEmbed(dashboardData);
      const buttons = createDashboardButtons();

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
    } catch (error) {
      console.error('[Dashboard] Error:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Error en Dashboard',
          description: 'Error al cargar el dashboard administrativo. Revisa los logs del sistema.',
          color: 0xe74c3c
        })]
      });
    }
  }
};

async function collectDashboardData() {
  try {
    // Economía
    const totalCirculation = economy.getTotalCirculation();
    const houseFunds = economy.getHouseFunds();
    const allUsers = economy.getAllUsers();

    // Sistemas activos
    const activeGiveaways = giveaways.getAllActiveGiveaways().length;
    const activeEvents = sports.getAllActiveEvents().length;
    const activeRaces = insidetrack.getActiveRaces().length;

    // Membresías
    const activeMemberships = memberships.getAllActiveMemberships().length;

    // Recompensas diarias
    const dailyStats = getDailyStats() || { today: { claims: 0, totalAmount: 0 }, activeUsers: { count: 0 } };

    // Logs
    const logStats = getLogStats('24 hours') || { summary: { total_logs: 0, unique_users: 0 } };

    // Estadísticas de usuarios
    const topUsers = allUsers.slice(0, 5);
    const richUsers = allUsers.filter(u => u.balance > 10000).length;
    const activeUsers = allUsers.filter(u => u.total_won > 0 || u.total_lost > 0).length;

    return {
      economy: {
        totalCirculation,
        houseFunds,
        totalUsers: allUsers.length,
        richUsers,
        activeUsers,
        topUsers
      },
      systems: {
        activeGiveaways,
        activeEvents,
        activeRaces,
        activeMemberships
      },
      daily: dailyStats,
      logs: logStats,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[Dashboard] Error collecting data:', error);
    throw error;
  }
}

async function collectDashboardData() {
  try {
    // Economía
    const totalCirculation = economy.getTotalCirculation();
    const houseFunds = economy.getHouseFunds();
    const allUsers = economy.getAllUsers();

    // Sistemas activos
    const activeGiveaways = giveaways.getAllActiveGiveaways().length;
    const activeEvents = sports.getAllActiveEvents().length;
    const activeRaces = insidetrack.getActiveRaces().length;

    // Membresías
    const activeMemberships = memberships.getAllActiveMemberships().length;

    // Recompensas diarias
    const dailyStats = getDailyStats() || { today: { claims: 0, totalAmount: 0 }, activeUsers: { count: 0 } };

    // Logs
    const logStats = getLogStats('24 hours') || { summary: { total_logs: 0, unique_users: 0 } };

    // Estadísticas de usuarios
    const topUsers = allUsers.slice(0, 5);
    const richUsers = allUsers.filter(u => u.balance > 10000).length;
    const activeUsers = allUsers.filter(u => u.total_won > 0 || u.total_lost > 0).length;

    return {
      economy: {
        totalCirculation,
        houseFunds,
        totalUsers: allUsers.length,
        richUsers,
        activeUsers,
        topUsers
      },
      systems: {
        activeGiveaways,
        activeEvents,
        activeRaces,
        activeMemberships
      },
      daily: dailyStats,
      logs: logStats,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('[Dashboard] Error collecting data:', error);
    throw error;
  }
}

function createMainDashboardEmbed(data) {
  const embed = createEmbed({
    title: `📊 ${config.CASINO_NAME} - Dashboard Administrativo`,
    description: `**Panel de control completo del casino**\n*Última actualización: ${data.timestamp.toLocaleString('es-ES')}*\n\n━━━━━━━━━━━━━━━━━`,
    fields: [
      {
        name: '💰 ECONOMÍA GENERAL',
        value: `• **Circulación total:** ${config.CURRENCY_SYMBOL} ${data.economy.totalCirculation.toLocaleString()}\n• **Fondos de la casa:** ${config.CURRENCY_SYMBOL} ${data.economy.houseFunds.total_in.toLocaleString()} in / ${config.CURRENCY_SYMBOL} ${data.economy.houseFunds.total_out.toLocaleString()} out\n• **Balance neto:** ${config.CURRENCY_SYMBOL} ${(data.economy.houseFunds.total_in - data.economy.houseFunds.total_out).toLocaleString()}\n• **Total usuarios:** ${data.economy.totalUsers}\n• **Usuarios ricos (>10k):** ${data.economy.richUsers}\n• **Usuarios activos:** ${data.economy.activeUsers}`,
        inline: false
      },
      {
        name: '🎰 SISTEMAS ACTIVOS',
        value: `• **Sorteos activos:** ${data.systems.activeGiveaways}\n• **Eventos deportivos:** ${data.systems.activeEvents}\n• **Carreras activas:** ${data.systems.activeRaces}\n• **Membresías activas:** ${data.systems.activeMemberships}`,
        inline: true
      },
      {
        name: '🎁 ACTIVIDAD RECIENTE',
        value: `• **Reclamaciones hoy:** ${data.daily.today.claims}\n• **Pagado hoy:** ${config.CURRENCY_SYMBOL} ${data.daily.today.totalAmount.toLocaleString()}\n• **Usuarios diarios activos:** ${data.daily.activeUsers.count}`,
        inline: true
      },
      {
        name: '🔍 ACTIVIDAD DE LOGS (24h)',
        value: `• **Total logs:** ${data.logs.summary.total_logs || 0}\n• **Usuarios únicos:** ${data.logs.summary.unique_users || 0}\n• **Acciones admin:** ${data.logs.summary.admin_actions || 0}`,
        inline: true
      }
    ],
    color: 0x3498db,
    footer: 'Emerald Isle Casino ® - Dashboard Administrativo | Usa los botones para ver detalles'
  });

  return embed;
}

function createDashboardButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dashboard_users')
      .setLabel('👥 Usuarios')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('dashboard_economy')
      .setLabel('💰 Economía')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('dashboard_systems')
      .setLabel('🎰 Sistemas')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('dashboard_activity')
      .setLabel('📊 Actividad')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('dashboard_refresh')
      .setLabel('🔄 Actualizar')
      .setStyle(ButtonStyle.Success)
  );
}

function createUsersEmbed(data) {
  const topUsersText = data.economy.topUsers
    .map((user, index) => `${index + 1}. <@${user.user_id}> - ${config.CURRENCY_SYMBOL} ${user.balance.toLocaleString()}`)
    .join('\n');

  return createEmbed({
    title: `👥 ${config.CASINO_NAME} - Usuarios`,
    description: `**Estadísticas detalladas de usuarios**\n\n━━━━━━━━━━━━━━━━━`,
    fields: [
      {
        name: '📈 TOP BALANCES',
        value: topUsersText || 'No hay datos disponibles.',
        inline: false
      },
      {
        name: '📊 DEMOGRAFÍA',
        value: `• **Total registrados:** ${data.economy.totalUsers}\n• **Usuarios con actividad:** ${data.economy.activeUsers}\n• **Usuarios ricos (>10k):** ${data.economy.richUsers}\n• **Tasa de actividad:** ${data.economy.totalUsers > 0 ? Math.round((data.economy.activeUsers / data.economy.totalUsers) * 100) : 0}%`,
        inline: false
      }
    ],
    color: 0x9b59b6,
    footer: 'Emerald Isle Casino ® - Dashboard: Usuarios'
  });
}

function createEconomyEmbed(data) {
  const profit = data.economy.houseFunds.total_in - data.economy.houseFunds.total_out;
  const profitColor = profit >= 0 ? '📈' : '📉';

  return createEmbed({
    title: `💰 ${config.CASINO_NAME} - Economía`,
    description: `**Análisis económico detallado**\n\n━━━━━━━━━━━━━━━━━`,
    fields: [
      {
        name: '🏦 FONDOS DE LA CASA',
        value: `• **Entradas totales:** ${config.CURRENCY_SYMBOL} ${data.economy.houseFunds.total_in.toLocaleString()}\n• **Salidas totales:** ${config.CURRENCY_SYMBOL} ${data.economy.houseFunds.total_out.toLocaleString()}\n• **${profitColor} Beneficio neto:** ${config.CURRENCY_SYMBOL} ${profit.toLocaleString()}\n• **Ratio E/S:** ${(data.economy.houseFunds.total_out > 0 ? (data.economy.houseFunds.total_in / data.economy.houseFunds.total_out).toFixed(2) : 'N/A')}:1`,
        inline: false
      },
      {
        name: '💵 CIRCULACIÓN',
        value: `• **Dinero en circulación:** ${config.CURRENCY_SYMBOL} ${data.economy.totalCirculation.toLocaleString()}\n• **Promedio por usuario:** ${config.CURRENCY_SYMBOL} ${data.economy.totalUsers > 0 ? Math.round(data.economy.totalCirculation / data.economy.totalUsers) : 0}\n• **Concentración (>10k):** ${data.economy.richUsers} usuarios`,
        inline: false
      }
    ],
    color: 0x27ae60,
    footer: 'Emerald Isle Casino ® - Dashboard: Economía'
  });
}

function createSystemsEmbed(data) {
  return createEmbed({
    title: `🎰 ${config.CASINO_NAME} - Sistemas`,
    description: `**Estado de todos los sistemas del casino**\n\n━━━━━━━━━━━━━━━━━`,
    fields: [
      {
        name: '🎉 SORTEOS',
        value: `• **Activos:** ${data.systems.activeGiveaways}\n• **Estado:** ${data.systems.activeGiveaways > 0 ? '🟢 Operativo' : '🟡 Sin sorteos'}`,
        inline: true
      },
      {
        name: '⚽ DEPORTES',
        value: `• **Eventos activos:** ${data.systems.activeEvents}\n• **Estado:** ${data.systems.activeEvents > 0 ? '🟢 Operativo' : '🟡 Sin eventos'}`,
        inline: true
      },
      {
        name: '🐴 INSIDE TRACK',
        value: `• **Carreras activas:** ${data.systems.activeRaces}\n• **Estado:** ${data.systems.activeRaces > 0 ? '🟢 Operativo' : '🟡 Sin carreras'}`,
        inline: true
      },
      {
        name: '💎 MEMBRESÍAS',
        value: `• **Activas:** ${data.systems.activeMemberships}\n• **Estado:** 🟢 Operativo\n• **Roles Discord:** ${data.systems.activeMemberships > 0 ? 'Sincronizados' : 'No aplicable'}`,
        inline: true
      },
      {
        name: '🎰 JUEGOS',
        value: `• **Blackjack mesas:** Siempre disponible\n• **Ruleta mesas:** Siempre disponible\n• **Slots:** Siempre disponible\n• **Estado:** 🟢 Todos operativos`,
        inline: false
      }
    ],
    color: 0xe67e22,
    footer: 'Emerald Isle Casino ® - Dashboard: Sistemas'
  });
}

function createActivityEmbed(data) {
  return createEmbed({
    title: `📊 ${config.CASINO_NAME} - Actividad`,
    description: `**Métricas de actividad y engagement**\n\n━━━━━━━━━━━━━━━━━`,
    fields: [
      {
        name: '🎁 RECOMPENSAS DIARIAS',
        value: `• **Hoy - Reclamaciones:** ${data.daily.today.claims}\n• **Hoy - Total pagado:** ${config.CURRENCY_SYMBOL} ${data.daily.today.totalAmount.toLocaleString()}\n• **Usuarios activos diarios:** ${data.daily.activeUsers.count}\n• **Racha promedio:** ${data.daily.activeUsers.avgStreak} días`,
        inline: false
      },
      {
        name: '🔍 SISTEMA DE LOGS (24h)',
        value: `• **Total de logs:** ${data.logs.summary.total_logs || 0}\n• **Usuarios únicos:** ${data.logs.summary.unique_users || 0}\n• **Acciones admin:** ${data.logs.summary.admin_actions || 0}\n• **Monto total:** ${config.CURRENCY_SYMBOL} ${(data.logs.summary.total_amount || 0).toLocaleString()}`,
        inline: false
      }
    ],
    color: 0x95a5a6,
    footer: 'Emerald Isle Casino ® - Dashboard: Actividad'
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Panel administrativo completo del casino (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const dashboardData = await collectDashboardData();

      const embed = createMainDashboardEmbed(dashboardData);
      const buttons = createDashboardButtons();

      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
    } catch (error) {
      console.error('[Dashboard] Error:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Error en Dashboard',
          description: 'Error al cargar el dashboard administrativo. Revisa los logs del sistema.',
          color: 0xe74c3c
        })]
      });
    }
  },

  // Funciones auxiliares exportadas
  collectDashboardData,
  createMainDashboardEmbed,
  dashboardHandlers: {
    createUsersEmbed,
    createEconomyEmbed,
    createSystemsEmbed,
    createActivityEmbed
  }
};
