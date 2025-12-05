const { logsDb } = require('./index');

function logActivity(userId, action, details = null, options = {}) {
  const {
    category = 'general',
    adminId = null,
    guildId = null,
    channelId = null,
    amount = null,
    result = null,
    ipAddress = null,
    userAgent = null
  } = options;

  try {
    logsDb
      .prepare(`
        INSERT INTO activity_logs (
          user_id, action, details, category, admin_id,
          guild_id, channel_id, amount, result, ip_address, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        userId,
        action,
        details,
        category,
        adminId,
        guildId,
        channelId,
        amount,
        result,
        ipAddress,
        userAgent
      );
    return true;
  } catch (error) {
    console.error('[Logs] Error logging activity:', error);
    return false;
  }
}

function getActivityLogs(filters = {}, limit = 50, offset = 0) {
  try {
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      query += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
    }

    if (filters.adminId) {
      query += ' AND admin_id = ?';
      params.push(filters.adminId);
    }

    if (filters.guildId) {
      query += ' AND guild_id = ?';
      params.push(filters.guildId);
    }

    if (filters.dateFrom) {
      query += ' AND created_at >= ?';
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      query += ' AND created_at <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return logsDb.prepare(query).all(...params);
  } catch (error) {
    console.error('[Logs] Error getting activity logs:', error);
    return [];
  }
}

function getLogStats(timeRange = '24 hours') {
  try {
    // Convert time range to SQLite format
    const timeFilter = `datetime('now', '-${timeRange}')`;

    const stats = logsDb
      .prepare(`
        SELECT
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT admin_id) as admin_actions,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_amount,
          category,
          COUNT(*) as category_count
        FROM activity_logs
        WHERE created_at >= ${timeFilter}
        GROUP BY category
        ORDER BY category_count DESC
      `)
      .all();

    const summary = logsDb
      .prepare(`
        SELECT
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT admin_id) as admin_actions,
          SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_amount,
          SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_amount_negative
        FROM activity_logs
        WHERE created_at >= ${timeFilter}
      `)
      .get();

    return {
      summary,
      byCategory: stats,
      timeRange
    };
  } catch (error) {
    console.error('[Logs] Error getting log stats:', error);
    return { summary: {}, byCategory: [], timeRange };
  }
}

function getRecentActivity(limit = 10) {
  try {
    return logsDb
      .prepare(`
        SELECT * FROM activity_logs
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit);
  } catch (error) {
    console.error('[Logs] Error getting recent activity:', error);
    return [];
  }
}

function getUserActivity(userId, limit = 20) {
  try {
    return logsDb
      .prepare(`
        SELECT * FROM activity_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(userId, limit);
  } catch (error) {
    console.error('[Logs] Error getting user activity:', error);
    return [];
  }
}

function getAdminActivity(adminId, limit = 20) {
  try {
    return logsDb
      .prepare(`
        SELECT * FROM activity_logs
        WHERE admin_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(adminId, limit);
  } catch (error) {
    console.error('[Logs] Error getting admin activity:', error);
    return [];
  }
}

function cleanupOldLogs(daysToKeep = 30) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    const cutoff = cutoffDate.toISOString();

    const result = logsDb
      .prepare('DELETE FROM activity_logs WHERE created_at < ?')
      .run(cutoff);

    console.log(`[Logs] Cleaned up ${result.changes} old log entries older than ${daysToKeep} days`);
    return result.changes;
  } catch (error) {
    console.error('[Logs] Error cleaning up old logs:', error);
    return 0;
  }
}

// Helper functions for common logging scenarios
function logGameActivity(userId, gameType, action, amount = null, result = null, options = {}) {
  return logActivity(userId, action, `${gameType}: ${action}`, {
    ...options,
    category: 'gambling',
    amount,
    result
  });
}

function logEconomicActivity(userId, action, amount, description = '', options = {}) {
  return logActivity(userId, action, description, {
    ...options,
    category: 'economy',
    amount
  });
}

function logAdminActivity(adminId, action, targetUser = null, details = '', options = {}) {
  return logActivity(targetUser || adminId, action, details, {
    ...options,
    category: 'admin',
    adminId
  });
}

function logMembershipActivity(userId, action, membershipType, options = {}) {
  return logActivity(userId, action, `Membresía: ${membershipType}`, {
    ...options,
    category: 'membership'
  });
}

function logTournamentActivity(userId, action, tournamentId, options = {}) {
  return logActivity(userId, action, `Torneo ID: ${tournamentId}`, {
    ...options,
    category: 'tournament'
  });
}

module.exports = {
  logActivity,
  getActivityLogs,
  getLogStats,
  getRecentActivity,
  getUserActivity,
  getAdminActivity,
  cleanupOldLogs,
  logGameActivity,
  logEconomicActivity,
  logAdminActivity,
  logMembershipActivity,
  logTournamentActivity
};



