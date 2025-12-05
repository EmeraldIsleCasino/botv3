const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');
const {
  createTournament,
  getTournament,
  getAllTournaments,
  updateTournamentStatus,
  deleteTournament,
  joinTournament,
  leaveTournament,
  getTournamentParticipants,
  getParticipantCount,
  getTournamentStats
} = require('../database/tournaments');
const economy = require('../database/economy');

// Store tournament messages per guild
const tournamentMessages = new Map();

// Initialize tournament messages from database on startup
function initializeTournamentMessages() {
  // This would load from database if we wanted persistence
  // For now, messages will need to be recreated after restart
}

initializeTournamentMessages();

// Motivational messages for tournaments
const MOTIVATIONAL_MESSAGES = [
  "¡Demuestra tu habilidad y conviértete en el campeón del casino! 🏆",
  "Cada victoria te acerca más a la gloria eterna. ¡No te detengas! ⚡",
  "Los grandes jugadores no esperan oportunidades, las crean. ¡Únete ahora! 🎯",
  "Tu próxima victoria podría ser la que te haga legendario. ¡Participa! 🌟",
  "En el casino de los valientes, solo los mejores triunfan. ¿Eres uno de ellos? 💎",
  "La fortuna favorece a los audaces. ¡Únete y reclama tu premio! 🎰",
  "Cada punto cuenta, cada victoria importa. ¡Tu momento es ahora! 🚀",
  "Los campeones no se hacen esperando, se hacen compitiendo. ¡Únete! 🥇",
  "La diferencia entre bueno y legendario está en una sola victoria. ¡Participa! ⭐",
  "El torneo espera a jugadores como tú. ¿Listo para la gloria? 🎪"
];

function getRandomMotivationalMessage() {
  return MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)];
}

function getTournamentPointsDescription(gameType) {
  const points = gameType === 'blackjack' ? '10 puntos' : '5 puntos';
  return `${points} por cada victoria`;
}

function createTournamentEmbed(tournament, showMotivation = true) {
  const participants = getParticipantCount(tournament.id);
  const motivation = showMotivation ? getRandomMotivationalMessage() : '';

  const embed = createEmbed({
    title: `🏆 ${tournament.name}`,
    description: `${tournament.description}\n\n${motivation}`,
    fields: [
      {
        name: '🎮 JUEGO',
        value: `${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type.charAt(0).toUpperCase() + tournament.game_type.slice(1)}`,
        inline: true
      },
      {
        name: '⏰ DURACIÓN',
        value: `${Math.round((new Date(tournament.end_time) - new Date()) / (1000 * 60 * 60))} horas restantes`,
        inline: true
      },
      {
        name: '👥 PARTICIPANTES',
        value: `${participants}/${tournament.max_participants}`,
        inline: true
      },
      {
        name: '💰 CUOTA',
        value: tournament.entry_fee > 0 ? `${config.CURRENCY_SYMBOL} ${tournament.entry_fee.toLocaleString()}` : '¡GRATIS!',
        inline: true
      },
      {
        name: '🏆 SISTEMA',
        value: getTournamentPointsDescription(tournament.game_type),
        inline: true
      },
      {
        name: '📊 PREMIO',
        value: `${config.CURRENCY_SYMBOL} ${(participants * tournament.entry_fee).toLocaleString()}`,
        inline: true
      },
      {
        name: '🎯 CÓMO GANAR',
        value: '¡Acumula más puntos ganando en el juego! Cada victoria te acerca al primer lugar.',
        inline: false
      }
    ],
    color: getStatusColor(tournament.status),
    footer: `ID: ${tournament.id} | ${getStatusEmoji(tournament.status)} ${tournament.status === 'active' ? 'Activo - ¡Juega para ganar puntos!' : tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}`
  });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('torneos')
    .setDescription('Sistema completo de torneos del casino')
    .addSubcommand(subcommand =>
      subcommand
        .setName('crear')
        .setDescription('Crear un nuevo torneo de puntos (Admin)')
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre del torneo')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('descripcion')
            .setDescription('Descripción del torneo')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('juego')
          .setDescription('Tipo de juego para acumular puntos')
          .setRequired(true)
          .addChoices(
            { name: 'Blackjack (10 pts por victoria)', value: 'blackjack' },
            { name: 'Ruleta (5 pts por victoria)', value: 'roulette' }
          ))
        .addIntegerOption(option =>
          option.setName('duracion_horas')
            .setDescription('Duración del torneo en horas')
            .setMinValue(1)
            .setMaxValue(168)
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('max_participantes')
            .setDescription('Máximo número de participantes')
            .setMinValue(2)
            .setMaxValue(100))
        .addIntegerOption(option =>
          option.setName('cuota_entrada')
            .setDescription('Cuota de entrada en monedas')
            .setMinValue(0))
        .addStringOption(option =>
          option.setName('reglas')
            .setDescription('Reglas especiales del torneo')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Ver torneos disponibles'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('unirse')
        .setDescription('Unirse a un torneo')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID del torneo')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('salir')
        .setDescription('Salir de un torneo')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID del torneo')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('info')
        .setDescription('Ver información detallada de un torneo')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID del torneo')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('admin')
        .setDescription('Comandos administrativos de torneos (Admin)')
        .addStringOption(option =>
          option.setName('accion')
            .setDescription('Acción a realizar')
            .setRequired(true)
            .addChoices(
              { name: 'Iniciar torneo', value: 'start' },
              { name: 'Finalizar torneo ahora', value: 'end_now' },
              { name: 'Eliminar torneo', value: 'delete' }
            ))
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID del torneo')
            .setRequired(true))
        .addUserOption(option =>
          option.setName('ganador')
            .setDescription('Usuario ganador (solo para finalizar)')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('estadisticas')
        .setDescription('Ver estadísticas globales de torneos')),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'crear':
        await createTournamentCommand(interaction);
        break;
      case 'listar':
        await listTournamentsCommand(interaction);
        break;
      case 'unirse':
        await joinTournamentCommand(interaction);
        break;
      case 'salir':
        await leaveTournamentCommand(interaction);
        break;
      case 'info':
        await tournamentInfoCommand(interaction);
        break;
      case 'admin':
        await adminTournamentCommand(interaction);
        break;
      case 'estadisticas':
        await tournamentStatsCommand(interaction);
        break;
    }
  }
};

async function createTournamentCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      embeds: [errorEmbed('Solo los administradores pueden crear torneos.')],
      flags: 64
    });
  }

  await interaction.deferReply({ flags: 64 });

  const name = interaction.options.getString('nombre');
  const description = interaction.options.getString('descripcion');
  const gameType = interaction.options.getString('juego');
  const durationHours = interaction.options.getInteger('duracion_horas');
  const maxParticipants = interaction.options.getInteger('max_participantes') || 50;
  const entryFee = interaction.options.getInteger('cuota_entrada') || 0;
  const rules = interaction.options.getString('reglas');

  const tournament = createTournament(
    name,
    description,
    gameType,
    maxParticipants,
    entryFee,
    interaction.user.id,
    rules,
    durationHours
  );

  if (!tournament) {
    return interaction.editReply({
      embeds: [errorEmbed('Error al crear el torneo.')]
    });
  }

  // Create tournament message with buttons
  const embed = createTournamentEmbed(tournament);
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tournament_join_${tournament.id}`)
      .setLabel('🎯 Unirme al Torneo')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`tournament_leave_${tournament.id}`)
      .setLabel('👋 Salir del Torneo')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('tournament_list')
      .setLabel('📋 Más Torneos')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`tournament_info_${tournament.id}`)
      .setLabel('📊 Ver Ranking')
      .setStyle(ButtonStyle.Secondary)
  );

  const message = await interaction.channel.send({
    embeds: [embed],
    components: [buttons]
  });

  // Store message reference
  if (!tournamentMessages.has(interaction.guildId)) {
    tournamentMessages.set(interaction.guildId, new Map());
  }
  tournamentMessages.get(interaction.guildId).set(tournament.id, {
    messageId: message.id,
    channelId: message.channelId
  });

  await interaction.editReply({
    embeds: [createEmbed({
      title: '✅ Torneo Creado Exitosamente',
      description: `**${tournament.name}** ha sido publicado en este canal.\n\nLos usuarios pueden unirse haciendo clic en "Unirme al Torneo".\n\n**ID del torneo:** ${tournament.id}`,
      color: 0x2ecc71,
      footer: 'Emerald Isle Casino ®'
    })]
  });
}

async function listTournamentsCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  const tournaments = getAllTournaments('active');

  if (tournaments.length === 0) {
    return interaction.editReply({
      embeds: [createEmbed({
        title: '🏆 Torneos Disponibles',
        description: 'No hay torneos activos en este momento.',
        color: 0x95a5a6
      })]
    });
  }

  const tournamentList = tournaments.slice(0, 10).map(tournament => {
    const participants = getParticipantCount(tournament.id);
    const statusEmoji = getStatusEmoji(tournament.status);

    return `**${statusEmoji} ${tournament.name}** (ID: ${tournament.id})\n` +
           `🎮 ${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type} | 👥 ${participants}/${tournament.max_participants} | 💰 ${config.CURRENCY_SYMBOL} ${tournament.entry_fee}`;
  }).join('\n\n');

  const embed = createEmbed({
    title: '🏆 Torneos Disponibles',
    description: tournamentList,
    color: 0x3498db,
    footer: 'Usa /torneos info [ID] para ver detalles completos'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function joinTournamentCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  const tournamentId = interaction.options.getInteger('id');
  const userId = interaction.user.id;

  const result = joinTournament(tournamentId, userId);

  if (!result.success) {
    let errorMessage = 'Error al unirte al torneo.';
    switch (result.reason) {
      case 'not_available':
        errorMessage = 'Este torneo no está disponible para unirse.';
        break;
      case 'already_joined':
        errorMessage = 'Ya estás participando en este torneo.';
        break;
      case 'full':
        errorMessage = 'Este torneo ya está lleno.';
        break;
      case 'insufficient_funds':
        errorMessage = 'No tienes suficiente saldo para la cuota de entrada.';
        break;
    }

    return interaction.editReply({
      embeds: [errorEmbed(errorMessage)]
    });
  }

  const embed = createEmbed({
    title: `✅ Unido al Torneo`,
    description: `Te has unido exitosamente al torneo **${result.tournament.name}**!\n\n💰 **Cuota pagada:** ${config.CURRENCY_SYMBOL} ${result.tournament.entry_fee.toLocaleString()}`,
    color: 0x2ecc71,
    footer: '¡Buena suerte en el torneo!'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function leaveTournamentCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  const tournamentId = interaction.options.getInteger('id');
  const userId = interaction.user.id;

  const success = leaveTournament(tournamentId, userId);

  if (!success) {
    return interaction.editReply({
      embeds: [errorEmbed('No puedes salir de este torneo (puede que no estés participando o ya haya empezado).')]
    });
  }

  const tournament = getTournament(tournamentId);

  const embed = createEmbed({
    title: `👋 Saliste del Torneo`,
    description: `Has salido del torneo **${tournament.name}**.\n\n💰 **Cuota reembolsada:** ${config.CURRENCY_SYMBOL} ${tournament.entry_fee.toLocaleString()}`,
    color: 0xf39c12,
    footer: 'Puedes unirte a otros torneos disponibles'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function tournamentInfoCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  const tournamentId = interaction.options.getInteger('id');
  const tournament = getTournament(tournamentId);

  if (!tournament) {
    return interaction.editReply({
      embeds: [errorEmbed('Torneo no encontrado.')]
    });
  }

  const participants = getTournamentParticipants(tournamentId);
  const participantCount = participants.length;

  // Crear ranking por puntos
  const ranking = participants
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((p, index) => `${index + 1}. <@${p.user_id}> - **${p.score}** puntos`)
    .join('\n');

  const participantList = participants.length > 0
    ? participants.slice(0, 5).map(p => `<@${p.user_id}>`).join(', ') +
      (participants.length > 5 ? `\n... y ${participants.length - 5} más` : '')
    : 'Ningún participante aún.';

  const embed = createEmbed({
    title: `🏆 ${tournament.name}`,
    description: tournament.description,
    color: getStatusColor(tournament.status),
    footer: `Creado por ${tournament.created_by} | Emerald Isle Casino ®`
  });

  embed.addFields([
    {
      name: '📊 Información General',
      value: `**ID:** ${tournament.id}\n**Estado:** ${getStatusEmoji(tournament.status)} ${tournament.status}\n**Creado:** ${new Date(tournament.created_at).toLocaleDateString('es-ES')}`,
      inline: true
    },
    {
      name: '🎮 Detalles del Juego',
      value: `**Tipo:** ${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type}\n**Máx. Participantes:** ${tournament.max_participants}\n**Cuota:** ${config.CURRENCY_SYMBOL} ${tournament.entry_fee.toLocaleString()}`,
      inline: true
    },
      {
        name: '🏆 RANKING DE PUNTOS',
        value: ranking || 'No hay participantes aún.',
        inline: false
      },
      {
        name: '👥 Lista de Participantes',
        value: `**Total:** ${participantCount}/${tournament.max_participants}\n\n${participantList}`,
        inline: false
      }
  ]);

  if (tournament.rules) {
    embed.addFields({
      name: '📋 Reglas Especiales',
      value: tournament.rules,
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function adminTournamentCommand(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      embeds: [errorEmbed('Solo los administradores pueden gestionar torneos.')],
      flags: 64
    });
  }

  await interaction.deferReply({ flags: 64 });

  const action = interaction.options.getString('accion');
  const tournamentId = interaction.options.getInteger('id');
  const winner = interaction.options.getUser('ganador');

  const tournament = getTournament(tournamentId);
  if (!tournament) {
    return interaction.editReply({
      embeds: [errorEmbed('Torneo no encontrado.')]
    });
  }

  let success = false;
  let message = '';

  switch (action) {
    case 'start':
      if (tournament.status !== 'registration') {
        message = 'Este torneo no puede ser iniciado.';
      } else {
        success = updateTournamentStatus(tournamentId, 'active');
        message = 'Torneo iniciado exitosamente.';
      }
      break;

    case 'end_now':
      if (tournament.status !== 'active') {
        message = 'Este torneo no puede ser finalizado.';
      } else {
        // Si no se especifica ganador, determinar automáticamente por puntos
        let winnerId = winner ? winner.id : null;
        if (!winnerId) {
          const participants = getTournamentParticipants(tournamentId);
          if (participants.length > 0) {
            const sortedParticipants = participants.sort((a, b) => b.score - a.score);
            winnerId = sortedParticipants[0].user_id;
          }
        }

        if (winnerId) {
          success = updateTournamentStatus(tournamentId, 'completed', winnerId);
          const winnerName = winner ? winner.username : `<@${winnerId}>`;
          message = `Torneo finalizado. Ganador: ${winnerName}`;
        } else {
          success = updateTournamentStatus(tournamentId, 'completed');
          message = 'Torneo finalizado sin ganador (sin participantes).';
        }
      }
      break;

    case 'delete':
      success = deleteTournament(tournamentId);
      message = success ? 'Torneo eliminado exitosamente.' : 'Error al eliminar el torneo.';
      break;
  }

  const embed = createEmbed({
    title: `🏆 Gestión de Torneo`,
    description: success ? `✅ ${message}` : `❌ ${message}`,
    color: success ? 0x2ecc71 : 0xe74c3c,
    footer: 'Emerald Isle Casino ® - Administración de Torneos'
  });

  await interaction.editReply({ embeds: [embed] });
}

async function tournamentStatsCommand(interaction) {
  await interaction.deferReply({ flags: 64 });

  const stats = getTournamentStats();

  const embed = createEmbed({
    title: `📊 Estadísticas de Torneos`,
    fields: [
      {
        name: '🏆 Torneos Totales',
        value: `• **Creados:** ${stats.totalTournaments}\n• **Activos:** ${stats.activeTournaments}\n• **Completados:** ${stats.completedTournaments}`,
        inline: true
      },
      {
        name: '👥 Participación',
        value: `• **Total participantes:** ${stats.totalParticipants}\n• **Prize pool acumulado:** ${config.CURRENCY_SYMBOL} ${stats.totalPrizePool.toLocaleString()}`,
        inline: true
      }
    ],
    color: 0x9b59b6,
    footer: 'Emerald Isle Casino ® - Estadísticas de Torneos'
  });

  await interaction.editReply({ embeds: [embed] });
}

// Helper functions
function getGameTypeEmoji(gameType) {
  const emojis = {
    blackjack: '🂠',
    roulette: '🎡',
    poker: '🃏',
    slots: '🎰'
  };
  return emojis[gameType] || '🎮';
}

function getStatusEmoji(status) {
  const emojis = {
    registration: '📝',
    active: '🏃',
    completed: '🏆',
    cancelled: '❌'
  };
  return emojis[status] || '❓';
}

function getStatusColor(status) {
  const colors = {
    registration: 0xf1c40f,
    active: 0x3498db,
    completed: 0x2ecc71,
    cancelled: 0xe74c3c
  };
  return colors[status] || 0x95a5a6;
}

// Export functions for use in other files
module.exports = {
  ...module.exports,
  createTournamentEmbed,
  getGameTypeEmoji,
  getStatusEmoji,
  getStatusColor,
  getTournamentPointsDescription,
  getRandomMotivationalMessage
};
