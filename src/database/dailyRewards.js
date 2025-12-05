const { dailyRewardsDb } = require('./index');
const economy = require('./economy');
const config = require('../utils/config');

function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayDate() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

function getUserStreak(userId) {
  try {
    const streak = dailyRewardsDb
      .prepare('SELECT * FROM user_streaks WHERE user_id = ?')
      .get(userId);

    return streak || {
      user_id: userId,
      current_streak: 0,
      longest_streak: 0,
      last_claim_date: null,
      total_claims: 0,
      total_earned: 0,
      updated_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[DailyRewards] Error getting user streak:', error);
    return null;
  }
}

function updateUserStreak(userId, newStreak, longestStreak, totalClaims, totalEarned) {
  try {
    dailyRewardsDb
      .prepare(`
        INSERT OR REPLACE INTO user_streaks
        (user_id, current_streak, longest_streak, last_claim_date, total_claims, total_earned, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        userId,
        newStreak,
        longestStreak,
        getTodayDate(),
        totalClaims,
        totalEarned,
        new Date().toISOString()
      );
    return true;
  } catch (error) {
    console.error('[DailyRewards] Error updating user streak:', error);
    return false;
  }
}

function canClaimToday(userId) {
  try {
    const today = getTodayDate();
    const existing = dailyRewardsDb
      .prepare('SELECT id FROM daily_rewards WHERE user_id = ? AND reward_date = ?')
      .get(userId, today);

    return !existing;
  } catch (error) {
    console.error('[DailyRewards] Error checking claim status:', error);
    return false;
  }
}

function calculateReward(userId) {
  const streak = getUserStreak(userId);
  if (!streak) return 0;

  const today = getTodayDate();
  const yesterday = getYesterdayDate();

  let newStreak = 1;
  let rewardMultiplier = 1;

  // Check if yesterday was claimed
  if (streak.last_claim_date === yesterday) {
    newStreak = streak.current_streak + 1;
    rewardMultiplier = Math.min(newStreak, 7); // Cap multiplier at 7x
  } else if (streak.last_claim_date === today) {
    // Already claimed today
    return 0;
  }
  // If not yesterday, streak resets to 1

  const baseReward = parseInt(config.DAILY_REWARD_BASE || '500');
  const streakBonus = parseInt(config.DAILY_REWARD_STREAK_BONUS || '100');

  const reward = baseReward + ((newStreak - 1) * streakBonus);

  return {
    amount: reward,
    streak: newStreak,
    multiplier: rewardMultiplier,
    baseReward,
    streakBonus: (newStreak - 1) * streakBonus
  };
}

function claimDailyReward(userId) {
  try {
    if (!canClaimToday(userId)) {
      return { success: false, reason: 'already_claimed' };
    }

    const reward = calculateReward(userId);
    if (reward.amount <= 0) {
      return { success: false, reason: 'calculation_error' };
    }

    // Add reward to user balance
    const newBalance = economy.addBalance(userId, reward.amount, null, 'Recompensa diaria');

    // Record the claim
    const today = getTodayDate();
    dailyRewardsDb
      .prepare(`
        INSERT INTO daily_rewards (user_id, reward_date, streak_count, reward_amount)
        VALUES (?, ?, ?, ?)
      `)
      .run(userId, today, reward.streak, reward.amount);

    // Update user streak
    const currentStreak = getUserStreak(userId);
    const longestStreak = Math.max(currentStreak.longest_streak, reward.streak);
    const totalClaims = currentStreak.total_claims + 1;
    const totalEarned = currentStreak.total_earned + reward.amount;

    updateUserStreak(userId, reward.streak, longestStreak, totalClaims, totalEarned);

    // Log activity
    const { logEconomicActivity } = require('./logs');
    logEconomicActivity(userId, 'daily_reward_claimed', reward.amount, `Racha: ${reward.streak} días`);

    return {
      success: true,
      amount: reward.amount,
      streak: reward.streak,
      longestStreak,
      newBalance,
      multiplier: reward.multiplier,
      baseReward: reward.baseReward,
      streakBonus: reward.streakBonus
    };
  } catch (error) {
    console.error('[DailyRewards] Error claiming daily reward:', error);
    return { success: false, reason: 'error', error: error.message };
  }
}

function getUserDailyStats(userId) {
  try {
    const streak = getUserStreak(userId);
    const todayClaimed = !canClaimToday(userId);
    const reward = calculateReward(userId);

    return {
      streak: streak.current_streak,
      longestStreak: streak.longest_streak,
      totalClaims: streak.total_claims,
      totalEarned: streak.total_earned,
      lastClaimDate: streak.last_claim_date,
      todayClaimed,
      nextReward: reward.amount,
      nextRewardBreakdown: {
        base: reward.baseReward,
        streakBonus: reward.streakBonus,
        multiplier: reward.multiplier
      }
    };
  } catch (error) {
    console.error('[DailyRewards] Error getting user daily stats:', error);
    return null;
  }
}

function getTopStreaks(limit = 10) {
  try {
    return dailyRewardsDb
      .prepare(`
        SELECT
          user_id,
          current_streak,
          longest_streak,
          total_claims,
          total_earned,
          last_claim_date
        FROM user_streaks
        ORDER BY current_streak DESC, longest_streak DESC
        LIMIT ?
      `)
      .all(limit);
  } catch (error) {
    console.error('[DailyRewards] Error getting top streaks:', error);
    return [];
  }
}

function getDailyStats() {
  try {
    const today = getTodayDate();
    const yesterday = getYesterdayDate();

    const todayClaims = dailyRewardsDb
      .prepare('SELECT COUNT(*) as count, SUM(reward_amount) as total FROM daily_rewards WHERE reward_date = ?')
      .get(today);

    const yesterdayClaims = dailyRewardsDb
      .prepare('SELECT COUNT(*) as count, SUM(reward_amount) as total FROM daily_rewards WHERE reward_date = ?')
      .get(yesterday);

    const activeStreaks = dailyRewardsDb
      .prepare(`
        SELECT
          COUNT(*) as count,
          AVG(current_streak) as avg_streak,
          MAX(current_streak) as max_streak
        FROM user_streaks
        WHERE last_claim_date >= ?
      `)
      .get(yesterday); // Active if claimed yesterday or today

    return {
      today: {
        claims: todayClaims.count || 0,
        totalAmount: todayClaims.total || 0
      },
      yesterday: {
        claims: yesterdayClaims.count || 0,
        totalAmount: yesterdayClaims.total || 0
      },
      activeUsers: {
        count: activeStreaks.count || 0,
        avgStreak: Math.round(activeStreaks.avg_streak || 0),
        maxStreak: activeStreaks.max_streak || 0
      }
    };
  } catch (error) {
    console.error('[DailyRewards] Error getting daily stats:', error);
    return null;
  }
}

function resetBrokenStreaks() {
  try {
    // Reset streaks for users who haven't claimed in more than 2 days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const cutoff = twoDaysAgo.toISOString().split('T')[0];

    const result = dailyRewardsDb
      .prepare(`
        UPDATE user_streaks
        SET current_streak = 0, updated_at = ?
        WHERE last_claim_date < ?
      `)
      .run(new Date().toISOString(), cutoff);

    console.log(`[DailyRewards] Reset ${result.changes} broken streaks`);
    return result.changes;
  } catch (error) {
    console.error('[DailyRewards] Error resetting broken streaks:', error);
    return 0;
  }
}

// Initialize config values if not set
function initializeConfig() {
  if (!config.DAILY_REWARD_BASE) {
    config.DAILY_REWARD_BASE = '500';
  }
  if (!config.DAILY_REWARD_STREAK_BONUS) {
    config.DAILY_REWARD_STREAK_BONUS = '100';
  }
}

initializeConfig();

module.exports = {
  canClaimToday,
  calculateReward,
  claimDailyReward,
  getUserDailyStats,
  getTopStreaks,
  getDailyStats,
  resetBrokenStreaks,
  getUserStreak
};



