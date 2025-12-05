const { economyDb } = require('./index');

function getUser(userId) {
  let user = economyDb.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  if (!user) {
    economyDb.prepare('INSERT INTO users (user_id, balance) VALUES (?, 0)').run(userId);
    user = economyDb.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  }
  return user;
}

function getBalance(userId) {
  const user = getUser(userId);
  return user.balance;
}

function addBalance(userId, amount, adminId, description = 'Recarga') {
  const user = getUser(userId);
  const newBalance = user.balance + amount;
  economyDb.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, userId);
  economyDb.prepare('INSERT INTO transactions (user_id, amount, type, description, admin_id) VALUES (?, ?, ?, ?, ?)').run(userId, amount, 'credit', description, adminId);
  economyDb.prepare('UPDATE house_funds SET total_out = total_out + ? WHERE id = 1').run(amount);

  // Log economic activity
  const { logEconomicActivity } = require('./logs');
  logEconomicActivity(userId, 'balance_added', amount, description, { adminId });

  return newBalance;
}

function removeBalance(userId, amount, adminId, description = 'Retiro admin') {
  const user = getUser(userId);
  const newBalance = Math.max(0, user.balance - amount);
  const actualRemoved = user.balance - newBalance;
  economyDb.prepare('UPDATE users SET balance = ? WHERE user_id = ?').run(newBalance, userId);
  if (actualRemoved > 0) {
    economyDb.prepare('INSERT INTO transactions (user_id, amount, type, description, admin_id) VALUES (?, ?, ?, ?, ?)').run(userId, -actualRemoved, 'debit', description, adminId);
    economyDb.prepare('UPDATE house_funds SET total_in = total_in + ? WHERE id = 1').run(actualRemoved);
  }
  return { newBalance, removed: actualRemoved };
}

function deductForBet(userId, amount) {
  const user = getUser(userId);
  if (user.balance < amount) return false;
  economyDb.prepare('UPDATE users SET balance = balance - ?, total_lost = total_lost + ? WHERE user_id = ?').run(amount, amount, userId);

  // Log gambling activity
  const { logGameActivity } = require('./logs');
  logGameActivity(userId, 'bet_placed', 'Apuesta realizada', amount);

  return true;
}

function addWinnings(userId, amount) {
  economyDb.prepare('UPDATE users SET balance = balance + ?, total_won = total_won + ? WHERE user_id = ?').run(amount, amount, userId);

  // Log winnings
  const { logGameActivity } = require('./logs');
  logGameActivity(userId, 'winnings_paid', 'Ganancias pagadas', amount, 'win');

  return getBalance(userId);
}

function getAllUsers() {
  return economyDb.prepare('SELECT * FROM users ORDER BY balance DESC').all();
}

function getTotalCirculation() {
  const result = economyDb.prepare('SELECT SUM(balance) as total FROM users').get();
  return result.total || 0;
}

function getHouseFunds() {
  return economyDb.prepare('SELECT * FROM house_funds WHERE id = 1').get();
}

function getTransactions(userId, limit = 10) {
  return economyDb.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
}

function getWeeklyStats(userId) {
  const memberships = require('./memberships');
  const weekStart = memberships.getWeekStart();
  const weeklyLoss = memberships.getWeeklyLoss(userId, weekStart);

  return {
    totalLoss: weeklyLoss,
    weekStart: weekStart
  };
}

module.exports = {
  getUser,
  getBalance,
  addBalance,
  removeBalance,
  deductForBet,
  addWinnings,
  getAllUsers,
  getTotalCirculation,
  getHouseFunds,
  getTransactions,
  getWeeklyStats
};
