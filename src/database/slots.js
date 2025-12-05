const { slotsDb } = require('./index');

function recordSpin(userId, game, betAmount, result, payout) {
  slotsDb.prepare('INSERT INTO spins (user_id, game, bet_amount, result, payout) VALUES (?, ?, ?, ?, ?)')
    .run(userId, game, betAmount, result, payout);
  
  slotsDb.prepare('UPDATE slots_house SET total_wagered = total_wagered + ?, total_paid = total_paid + ? WHERE id = 1')
    .run(betAmount, payout);
}

function getSlotsHouse() {
  return slotsDb.prepare('SELECT * FROM slots_house WHERE id = 1').get();
}

function getUserSpins(userId, limit = 10) {
  return slotsDb.prepare('SELECT * FROM spins WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
}

module.exports = {
  recordSpin,
  getSlotsHouse,
  getUserSpins
};
