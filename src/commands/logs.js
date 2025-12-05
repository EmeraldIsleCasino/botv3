const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');
const {
  getActivityLogs,
  getLogStats,
  getRecentActivity,
  getUserActivity,
  getAdminActivity
} = require('../database/logs');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('Sistema avanzado de logs de actividad (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('recientes')
        .setDescription('Ver actividad reciente del casino')
        .addIntegerOption(option =>
          option.setName('cantidad')
            .setDescription('Número de entradas a mostrar (máx 50)')
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('usuario')
        .setDescription('Ver actividad de un usuario específico')
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuario a revisar')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('cantidad')
            .setDescription('Número de entradas a mostrar (máx 50)')
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('admin')
        .setDescription('Ver actividad administrativa')
        .addIntegerOption(option =>
          option.setName('cantidad')
            .setDescription('Número de entradas a mostrar (máx 50)')
            .setMinValue(1)
            .setMaxValue(50)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('estadisticas')
        .setDescription('Ver estadísticas de actividad')
        .addStringOption(option =>
          option.setName('periodo')
            .setDescription('Período de tiempo')
            .addChoices(
              { name: 'Última hora', value: '1 hour' },
              { name: 'Últimas 24 horas', value: '24 hours' },
              { name: 'Última semana', value: '7 days' },
              { name: 'Último mes', value: '30 days' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('filtrar')
        .setDescription('Filtrar logs por categoría y acción')
        .addStringOption(option =>
          option.setName('categoria')
            .setDescription('Categoría de actividad')
            .addChoices(
              { name: 'Economía', value: 'economy' },
              { name: 'Juegos', value: 'gambling' },
              { name: 'Administración', value: 'admin' },
              { name: 'Membresías', value: 'membership' },
              { name: 'Torneos', value: 'tournament' },
              { name: 'General', value: 'general' }
            ))
        .addStringOption(option =>
          option.setName('accion')
            .setDescription('Tipo de acción específica'))
        .addIntegerOption(option =>
          option.setName('cantidad')
            .setDescription('Número de entradas a mostrar (máx 50)')
            .setMinValue(1)
            .setMaxValue(50))),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'recientes':
          await showRecentLogs(interaction);
          break;
        case 'usuario':
          await showUserLogs(interaction);
          break;
        case 'admin':
          await showAdminLogs(interaction);
          break;
        case 'estadisticas':
          await showLogStats(interaction);
          break;
        case 'filtrar':
          await showFilteredLogs(interaction);
          break;
      }
    } catch (error) {
      console.error('[Logs] Error in logs command:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error al obtener los logs. Revisa los logs del sistema.')]
      });
    }
  }
};

async function showRecentLogs(interaction) {
  const limit = interaction.options.getInteger('cantidad') || 10;

  const logs = getRecentActivity(limit);

  if (logs.length === 0) {
    return interaction.editReply({
      embeds: [createEmbed({
        title: '📋 Actividad Reciente',
        description: 'No hay actividad registrada aún.',
        color: 0xffa500
      })]
    });
  }

  const logEntries = logs.map(log => formatLogEntry(log)).join('\n');

  const embed = createEmbed({
    title: `📋 Actividad Reciente - ${config.CASINO_NAME}`,
    description: `**Últimas ${logs.length} actividades:**\n\n${logEntries}`,
    color: 0x3498db,
    footer: 'Emerald Isle Casino ® - Sistema de Logs'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function showUserLogs(interaction) {
  const user = interaction.options.getUser('usuario');
  const limit = interaction.options.getInteger('cantidad') || 10;

  const logs = getUserActivity(user.id, limit);

  const logEntries = logs.map(log => formatLogEntry(log, false)).join('\n');

  const embed = createEmbed({
    title: `👤 Actividad de ${user.username}`,
    description: logs.length > 0
      ? `**Últimas ${logs.length} actividades:**\n\n${logEntries}`
      : 'No hay actividad registrada para este usuario.',
    color: 0x9b59b6,
    footer: `Usuario: ${user.id} | Emerald Isle Casino ®`
  });

  await interaction.editReply({ embeds: [embed] });
}

async function showAdminLogs(interaction) {
  const limit = interaction.options.getInteger('cantidad') || 10;

  const logs = getAdminActivity(interaction.user.id, limit);

  const logEntries = logs.map(log => formatLogEntry(log)).join('\n');

  const embed = createEmbed({
    title: `👑 Actividad Administrativa`,
    description: logs.length > 0
      ? `**Últimas ${logs.length} acciones admin:**\n\n${logEntries}`
      : 'No hay actividad administrativa registrada.',
    color: 0xe74c3c,
    footer: 'Emerald Isle Casino ® - Logs Administrativos'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function showLogStats(interaction) {
  const timeRange = interaction.options.getString('periodo') || '24 hours';

  const stats = getLogStats(timeRange);

  const categoryStats = stats.byCategory
    .map(cat => `• **${cat.category}**: ${cat.category_count} actividades`)
    .join('\n');

  const embed = createEmbed({
    title: `📊 Estadísticas de Actividad - ${timeRange}`,
    fields: [
      {
        name: '📈 Resumen General',
        value: `• **Total de logs**: ${stats.summary.total_logs || 0}\n• **Usuarios únicos**: ${stats.summary.unique_users || 0}\n• **Acciones admin**: ${stats.summary.admin_actions || 0}\n• **Monto total**: ${config.CURRENCY_SYMBOL} ${(stats.summary.total_amount || 0).toLocaleString()}`,
        inline: false
      },
      {
        name: '📂 Actividad por Categoría',
        value: categoryStats || 'No hay datos disponibles.',
        inline: false
      }
    ],
    color: 0x2ecc71,
    footer: 'Emerald Isle Casino ® - Estadísticas de Logs'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function showFilteredLogs(interaction) {
  const category = interaction.options.getString('categoria');
  const action = interaction.options.getString('accion');
  const limit = interaction.options.getInteger('cantidad') || 10;

  const filters = {};
  if (category) filters.category = category;
  if (action) filters.action = action;

  const logs = getActivityLogs(filters, limit);

  const logEntries = logs.map(log => formatLogEntry(log)).join('\n');

  const filterDesc = [];
  if (category) filterDesc.push(`Categoría: ${category}`);
  if (action) filterDesc.push(`Acción: ${action}`);

  const embed = createEmbed({
    title: `🔍 Logs Filtrados`,
    description: `**Filtros aplicados:** ${filterDesc.join(', ') || 'Ninguno'}\n**Resultados:** ${logs.length}\n\n${logEntries || 'No se encontraron logs con estos filtros.'}`,
    color: 0xf39c12,
    footer: 'Emerald Isle Casino ® - Logs Filtrados'
  });

  await interaction.editReply({ embeds: [embed] });
}

function formatLogEntry(log, showUser = true) {
  const timestamp = new Date(log.created_at).toLocaleString('es-ES', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const userPart = showUser && log.user_id ? `<@${log.user_id}>` : '';
  const action = `**${log.action}**`;
  const category = log.category ? `[${log.category}]` : '';
  const amount = log.amount ? ` ${config.CURRENCY_SYMBOL}${log.amount.toLocaleString()}` : '';
  const details = log.details ? ` - ${log.details}` : '';

  return `\`${timestamp}\` ${userPart} ${action} ${category}${amount}${details}`;
}



