const { blackjackDb } = require('./index');

function recordGame(userId, bet, result, payout) {
  blackjackDb.prepare(`
    INSERT INTO blackjack_games (user_id, bet, result, payout)
    VALUES (?, ?, ?, ?)
  `).run(userId, bet, result, payout);

  blackjackDb.prepare(`
    UPDATE blackjack_house 
    SET total_wagered = total_wagered + ?, total_paid = total_paid + ?
    WHERE id = 1
  `).run(bet, payout);
}

function getBlackjackHouse() {
  return blackjackDb.prepare('SELECT * FROM blackjack_house WHERE id = 1').get();
}

function getUserGames(userId, limit = 10) {
  return blackjackDb.prepare(`
    SELECT * FROM blackjack_games 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, limit);
}

module.exports = {
  recordGame,
  getBlackjackHouse,
  getUserGames
};
