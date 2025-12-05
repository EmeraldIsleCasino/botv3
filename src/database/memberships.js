const { membershipsDb } = require("./index");

function createMembership(userId, membershipType, startDate, expirationDate) {
  // Cancelar membresía anterior si existe
  membershipsDb
    .prepare(
      "UPDATE memberships SET active = 0 WHERE user_id = ? AND active = 1",
    )
    .run(userId);

  // Crear nueva membresía
  membershipsDb
    .prepare(
      `
    INSERT INTO memberships (user_id, membership_type, start_date, expiration_date, active)
    VALUES (?, ?, ?, ?, 1)
  `,
    )
    .run(userId, membershipType, startDate, expirationDate);

  // Log membership activity
  const { logMembershipActivity } = require('./logs');
  logMembershipActivity(userId, 'membership_purchased', membershipType);

  return getMembership(userId);
}

function getMembership(userId) {
  return membershipsDb
    .prepare(
      `
    SELECT * FROM memberships 
    WHERE user_id = ? AND active = 1 
    ORDER BY created_at DESC 
    LIMIT 1
  `,
    )
    .get(userId);
}

function cancelMembership(userId) {
  return membershipsDb
    .prepare(
      "UPDATE memberships SET active = 0 WHERE user_id = ? AND active = 1",
    )
    .run(userId);
}

function getAllActiveMemberships() {
  return membershipsDb
    .prepare("SELECT * FROM memberships WHERE active = 1")
    .all();
}

function getExpiredMemberships() {
  const now = new Date().toISOString();
  return membershipsDb
    .prepare(
      `
    SELECT * FROM memberships 
    WHERE active = 1 AND expiration_date < ?
  `,
    )
    .all(now);
}

function expireMembership(userId) {
  return membershipsDb
    .prepare(
      "UPDATE memberships SET active = 0 WHERE user_id = ? AND active = 1",
    )
    .run(userId);
}

function updateMembershipExpiration(userId, newExpirationDate) {
  return membershipsDb
    .prepare(
      "UPDATE memberships SET expiration_date = ? WHERE user_id = ? AND active = 1",
    )
    .run(newExpirationDate, userId);
}

function getMembershipHistory(userId) {
  return membershipsDb
    .prepare(
      `
    SELECT * FROM memberships 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `,
    )
    .all(userId);
}

// Funciones para cashback semanal
function getWeekStart() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Lunes
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split("T")[0];
}

function recordWeeklyLoss(userId, lossAmount) {
  if (lossAmount <= 0) return;

  const weekStart = getWeekStart();
  const existing = membershipsDb
    .prepare("SELECT * FROM weekly_losses WHERE user_id = ? AND week_start = ?")
    .get(userId, weekStart);

  if (existing) {
    membershipsDb
      .prepare(
        "UPDATE weekly_losses SET total_loss = total_loss + ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ? AND week_start = ?",
      )
      .run(lossAmount, userId, weekStart);
  } else {
    membershipsDb
      .prepare(
        "INSERT INTO weekly_losses (user_id, week_start, total_loss) VALUES (?, ?, ?)",
      )
      .run(userId, weekStart, lossAmount);
  }
}

function getWeeklyLoss(userId, weekStart = null) {
  if (!weekStart) weekStart = getWeekStart();
  const record = membershipsDb
    .prepare("SELECT * FROM weekly_losses WHERE user_id = ? AND week_start = ?")
    .get(userId, weekStart);
  return record ? record.total_loss : 0;
}

function getAllWeeklyLosses(weekStart = null) {
  if (!weekStart) weekStart = getWeekStart();
  return membershipsDb
    .prepare(
      "SELECT * FROM weekly_losses WHERE week_start = ? AND total_loss > 0 AND cashback_applied = 0",
    )
    .all(weekStart);
}

function markCashbackApplied(userId, weekStart, cashbackAmount) {
  membershipsDb
    .prepare(
      "UPDATE weekly_losses SET cashback_applied = ?, last_updated = CURRENT_TIMESTAMP WHERE user_id = ? AND week_start = ?",
    )
    .run(cashbackAmount, userId, weekStart);
}

function resetWeeklyLosses(weekStart) {
  // Limpiar registros antiguos (más de 4 semanas)
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const cutoff = fourWeeksAgo.toISOString().split("T")[0];
  membershipsDb
    .prepare("DELETE FROM weekly_losses WHERE week_start < ?")
    .run(cutoff);
}

module.exports = {
  createMembership,
  getMembership,
  cancelMembership,
  getAllActiveMemberships,
  getExpiredMemberships,
  expireMembership,
  updateMembershipExpiration,
  getMembershipHistory,
  getWeekStart,
  recordWeeklyLoss,
  getWeeklyLoss,
  getAllWeeklyLosses,
  markCashbackApplied,
  resetWeeklyLosses,
};
