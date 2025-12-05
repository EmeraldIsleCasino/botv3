const { tournamentsDb } = require('./index');
const economy = require('./economy');

function createTournament(name, description, gameType, maxParticipants = 50, entryFee = 0, createdBy, rules = null, durationHours = 24) {
  try {
    const startTime = new Date().toISOString();
    const endTime = new Date(Date.now() + (durationHours * 60 * 60 * 1000)).toISOString();

    const tournamentId = tournamentsDb
      .prepare(`
        INSERT INTO tournaments (name, description, game_type, max_participants, entry_fee, created_by, rules, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `)
      .run(name, description, gameType, maxParticipants, entryFee, createdBy, rules, startTime, endTime)
      .lastInsertRowid;

    // Log tournament creation
    const { logTournamentActivity } = require('./logs');
    logTournamentActivity(createdBy, 'tournament_created', tournamentId);

    return getTournament(tournamentId);
  } catch (error) {
    console.error('[Tournaments] Error creating tournament:', error);
    return null;
  }
}

function getTournament(tournamentId) {
  try {
    return tournamentsDb
      .prepare('SELECT * FROM tournaments WHERE id = ?')
      .get(tournamentId);
  } catch (error) {
    console.error('[Tournaments] Error getting tournament:', error);
    return null;
  }
}

function getAllTournaments(status = null) {
  try {
    let query = 'SELECT * FROM tournaments';
    const params = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    return tournamentsDb.prepare(query).all(...params);
  } catch (error) {
    console.error('[Tournaments] Error getting tournaments:', error);
    return [];
  }
}

function updateTournamentStatus(tournamentId, status, winnerId = null) {
  try {
    // Build query dynamically based on whether winnerId is provided
    let query = `UPDATE tournaments SET status = ?, end_time = ? WHERE id = ?`;
    let params = [status, new Date().toISOString(), tournamentId];

    if (winnerId !== null) {
      query = `UPDATE tournaments SET status = ?, winner_id = ?, end_time = ? WHERE id = ?`;
      params = [status, winnerId, new Date().toISOString(), tournamentId];
    }

    const update = tournamentsDb.prepare(query).run(...params);

    if (update.changes > 0) {
      // Log status update
      const { logTournamentActivity } = require('./logs');
      const tournament = getTournament(tournamentId);
      logTournamentActivity(tournament.created_by, `tournament_${status}`, tournamentId);

      return true;
    }
    return false;
  } catch (error) {
    console.error('[Tournaments] Error updating tournament status:', error);
    return false;
  }
}

function deleteTournament(tournamentId) {
  try {
    // First, refund all participants
    const participants = getTournamentParticipants(tournamentId);
    for (const participant of participants) {
      if (participant.status === 'active') {
        const tournament = getTournament(tournamentId);
        economy.addBalance(participant.user_id, tournament.entry_fee, tournament.created_by, `Reembolso torneo: ${tournament.name}`);
      }
    }

    // Delete participants and games
    tournamentsDb.prepare('DELETE FROM tournament_participants WHERE tournament_id = ?').run(tournamentId);
    tournamentsDb.prepare('DELETE FROM tournament_games WHERE tournament_id = ?').run(tournamentId);
    tournamentsDb.prepare('DELETE FROM tournaments WHERE id = ?').run(tournamentId);

    return true;
  } catch (error) {
    console.error('[Tournaments] Error deleting tournament:', error);
    return false;
  }
}

function joinTournament(tournamentId, userId) {
  try {
    const tournament = getTournament(tournamentId);
    if (!tournament || tournament.status !== 'active') {
      return { success: false, reason: 'not_available' };
    }

    // Check if user is already participating
    const existing = tournamentsDb
      .prepare('SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
      .get(tournamentId, userId);

    if (existing) {
      return { success: false, reason: 'already_joined' };
    }

    // Check participant limit
    const participantCount = getParticipantCount(tournamentId);
    if (participantCount >= tournament.max_participants) {
      return { success: false, reason: 'full' };
    }

    // Check if user has enough balance
    const balance = economy.getBalance(userId);
    if (balance < tournament.entry_fee) {
      return { success: false, reason: 'insufficient_funds' };
    }

    // Deduct entry fee
    economy.deductForBet(userId, tournament.entry_fee);

    // Add participant
    tournamentsDb
      .prepare('INSERT INTO tournament_participants (tournament_id, user_id) VALUES (?, ?)')
      .run(tournamentId, userId);

    // Log participation
    const { logTournamentActivity } = require('./logs');
    logTournamentActivity(userId, 'tournament_joined', tournamentId);

    return { success: true, tournament };
  } catch (error) {
    console.error('[Tournaments] Error joining tournament:', error);
    return { success: false, reason: 'error' };
  }
}

function leaveTournament(tournamentId, userId) {
  try {
    const tournament = getTournament(tournamentId);
    if (!tournament || tournament.status !== 'active') {
      return false;
    }

    const participant = tournamentsDb
      .prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
      .get(tournamentId, userId);

    if (!participant) {
      return false;
    }

    // Refund entry fee
    economy.addBalance(userId, tournament.entry_fee, tournament.created_by, `Reembolso torneo: ${tournament.name}`);

    // Remove participant
    tournamentsDb
      .prepare('DELETE FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
      .run(tournamentId, userId);

    // Log leaving
    const { logTournamentActivity } = require('./logs');
    logTournamentActivity(userId, 'tournament_left', tournamentId);

    return true;
  } catch (error) {
    console.error('[Tournaments] Error leaving tournament:', error);
    return false;
  }
}

function getTournamentParticipants(tournamentId) {
  try {
    return tournamentsDb
      .prepare(`
        SELECT tp.*, t.entry_fee
        FROM tournament_participants tp
        JOIN tournaments t ON tp.tournament_id = t.id
        WHERE tp.tournament_id = ?
        ORDER BY tp.joined_at ASC
      `)
      .all(tournamentId);
  } catch (error) {
    console.error('[Tournaments] Error getting participants:', error);
    return [];
  }
}

function getParticipantCount(tournamentId) {
  try {
    const result = tournamentsDb
      .prepare('SELECT COUNT(*) as count FROM tournament_participants WHERE tournament_id = ?')
      .get(tournamentId);

    return result.count || 0;
  } catch (error) {
    console.error('[Tournaments] Error getting participant count:', error);
    return 0;
  }
}

function updateParticipantScore(tournamentId, userId, score) {
  try {
    tournamentsDb
      .prepare('UPDATE tournament_participants SET score = score + ? WHERE tournament_id = ? AND user_id = ?')
      .run(score, tournamentId, userId);
    return true;
  } catch (error) {
    console.error('[Tournaments] Error updating participant score:', error);
    return false;
  }
}

function getTournamentPoints(userId, gameType, tournamentId = null) {
  try {
    // Si se especifica torneo, solo puntos de ese torneo
    if (tournamentId) {
      const participant = tournamentsDb
        .prepare('SELECT score FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
        .get(tournamentId, userId);
      return participant ? participant.score : 0;
    }

    // Si no se especifica torneo, puntos de torneos activos del mismo tipo de juego
    const activeTournaments = getAllTournaments('active').filter(t => t.game_type === gameType);
    let totalPoints = 0;

    for (const tournament of activeTournaments) {
      const participant = tournamentsDb
        .prepare('SELECT score FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
        .get(tournament.id, userId);
      if (participant) {
        totalPoints += participant.score;
      }
    }

    return totalPoints;
  } catch (error) {
    console.error('[Tournaments] Error getting tournament points:', error);
    return 0;
  }
}

function awardTournamentPoints(userId, gameType, points, reason = 'game_win') {
  try {
    // Buscar torneos activos del tipo de juego especificado
    const activeTournaments = getAllTournaments('active').filter(t => t.game_type === gameType);

    for (const tournament of activeTournaments) {
      // Verificar si el usuario participa en este torneo
      const participant = tournamentsDb
        .prepare('SELECT id FROM tournament_participants WHERE tournament_id = ? AND user_id = ?')
        .get(tournament.id, userId);

      if (participant) {
        // Otorgar puntos al participante
        updateParticipantScore(tournament.id, userId, points);

        // Log activity
        const { logTournamentActivity } = require('./logs');
        logTournamentActivity(userId, 'tournament_points_awarded', tournament.id, `${points} puntos por ${reason}`);
      }
    }

    return true;
  } catch (error) {
    console.error('[Tournaments] Error awarding tournament points:', error);
    return false;
  }
}

function recordTournamentGame(tournamentId, gameId, player1Id, player2Id = null, winnerId = null, result = null) {
  try {
    tournamentsDb
      .prepare(`
        INSERT INTO tournament_games (tournament_id, game_id, player1_id, player2_id, winner_id, result)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(tournamentId, gameId, player1Id, player2Id, winnerId, result);

    return true;
  } catch (error) {
    console.error('[Tournaments] Error recording tournament game:', error);
    return false;
  }
}

function distributeTournamentPrize(tournamentId) {
  try {
    const tournament = getTournament(tournamentId);
    if (!tournament || tournament.status !== 'completed' || !tournament.winner_id) {
      return false;
    }

    const participants = getTournamentParticipants(tournamentId);
    const totalPrizePool = participants.length * tournament.entry_fee;

    // Give prize to winner
    economy.addBalance(tournament.winner_id, totalPrizePool, tournament.created_by, `Premio torneo: ${tournament.name}`);

    // Log prize distribution
    const { logTournamentActivity } = require('./logs');
    logTournamentActivity(tournament.winner_id, 'tournament_won', tournamentId);

    return true;
  } catch (error) {
    console.error('[Tournaments] Error distributing prize:', error);
    return false;
  }
}

function getTournamentStats() {
  try {
    const totalTournaments = tournamentsDb.prepare('SELECT COUNT(*) as count FROM tournaments').get().count;
    const activeTournaments = tournamentsDb.prepare('SELECT COUNT(*) as count FROM tournaments WHERE status = "active"').get().count;
    const completedTournaments = tournamentsDb.prepare('SELECT COUNT(*) as count FROM tournaments WHERE status = "completed"').get().count;

    const totalParticipants = tournamentsDb
      .prepare('SELECT COUNT(*) as count FROM tournament_participants')
      .get().count;

    const totalPrizePool = tournamentsDb
      .prepare(`
        SELECT SUM(tp.count * t.entry_fee) as total
        FROM (SELECT tournament_id, COUNT(*) as count FROM tournament_participants GROUP BY tournament_id) tp
        JOIN tournaments t ON tp.tournament_id = t.id
      `)
      .get().total || 0;

    return {
      totalTournaments,
      activeTournaments,
      completedTournaments,
      totalParticipants,
      totalPrizePool
    };
  } catch (error) {
    console.error('[Tournaments] Error getting tournament stats:', error);
    return {
      totalTournaments: 0,
      activeTournaments: 0,
      completedTournaments: 0,
      totalParticipants: 0,
      totalPrizePool: 0
    };
  }
}

module.exports = {
  createTournament,
  getTournament,
  getAllTournaments,
  updateTournamentStatus,
  deleteTournament,
  joinTournament,
  leaveTournament,
  getTournamentParticipants,
  getParticipantCount,
  updateParticipantScore,
  recordTournamentGame,
  distributeTournamentPrize,
  getTournamentStats,
  awardTournamentPoints
};

// Initialize database - ensure winner_id column exists
try {
  // Check if winner_id column exists, if not, add it
  const columns = tournamentsDb.prepare("PRAGMA table_info(tournaments)").all();
  const hasWinnerId = columns.some(col => col.name === 'winner_id');

  if (!hasWinnerId) {
    console.log('[Tournaments] Adding winner_id column to tournaments table');
    tournamentsDb.exec('ALTER TABLE tournaments ADD COLUMN winner_id TEXT');
  }
} catch (error) {
  console.warn('[Tournaments] Could not check/add winner_id column:', error.message);
}
