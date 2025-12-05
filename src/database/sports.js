const { sportsDb } = require('./index');

function createEvent(data) {
  const result = sportsDb.prepare(`
    INSERT INTO events (channel_id, message_id, title, sport, team1_name, team1_logo, team1_odds, team2_name, team2_logo, team2_odds, draw_odds)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.channelId, data.messageId, data.title, data.sport, data.team1Name, data.team1Logo, data.team1Odds, data.team2Name, data.team2Logo, data.team2Odds, data.drawOdds);
  return result.lastInsertRowid;
}

function updateEventMessageId(eventId, messageId) {
  sportsDb.prepare("UPDATE events SET message_id = ? WHERE id = ?").run(messageId, eventId);
}

function getActiveEvent(channelId) {
  return sportsDb.prepare("SELECT * FROM events WHERE channel_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(channelId);
}

function getAllActiveEvents() {
  return sportsDb.prepare("SELECT * FROM events WHERE status = 'open'").all();
}

function getLastActiveEvent(channelId) {
  return sportsDb.prepare("SELECT * FROM events WHERE channel_id = ? AND (status = 'open' OR status = 'closed') ORDER BY id DESC LIMIT 1").get(channelId);
}

function getChannelActiveEvents(channelId) {
  return sportsDb.prepare("SELECT * FROM events WHERE channel_id = ? AND (status = 'open' OR status = 'closed') ORDER BY id DESC").all(channelId);
}

function getEventById(eventId) {
  return sportsDb.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
}

function getEventByMessage(messageId) {
  return sportsDb.prepare('SELECT * FROM events WHERE message_id = ?').get(messageId);
}

function placeBet(eventId, userId, team, amount, potentialWin) {
  sportsDb.prepare('INSERT INTO sports_bets (event_id, user_id, team, amount, potential_win) VALUES (?, ?, ?, ?, ?)').run(eventId, userId, team, amount, potentialWin);
  sportsDb.prepare('UPDATE sports_house SET total_bets = total_bets + ? WHERE id = 1').run(amount);
}

function getUserBet(eventId, userId) {
  return sportsDb.prepare('SELECT * FROM sports_bets WHERE event_id = ? AND user_id = ?').get(eventId, userId);
}

function getEventBets(eventId) {
  return sportsDb.prepare('SELECT * FROM sports_bets WHERE event_id = ?').all(eventId);
}

function closeEvent(eventId) {
  sportsDb.prepare("UPDATE events SET status = 'closed' WHERE id = ?").run(eventId);
}

function finalizeEvent(eventId, winner) {
  sportsDb.prepare("UPDATE events SET status = 'finished', winner = ? WHERE id = ?").run(winner, eventId);
  const winningBets = sportsDb.prepare("SELECT * FROM sports_bets WHERE event_id = ? AND team = ?").all(eventId, winner);
  const losingBets = sportsDb.prepare("SELECT * FROM sports_bets WHERE event_id = ? AND team != ?").all(eventId, winner);
  
  let totalPaidOut = 0;
  winningBets.forEach(bet => {
    sportsDb.prepare("UPDATE sports_bets SET status = 'won' WHERE id = ?").run(bet.id);
    totalPaidOut += bet.potential_win;
  });
  
  let totalWonByHouse = 0;
  losingBets.forEach(bet => {
    sportsDb.prepare("UPDATE sports_bets SET status = 'lost' WHERE id = ?").run(bet.id);
    totalWonByHouse += bet.amount;
  });
  
  sportsDb.prepare('UPDATE sports_house SET total_won = total_won + ?, total_lost = total_lost + ? WHERE id = 1').run(totalWonByHouse, totalPaidOut);
  
  return { winningBets, losingBets, totalPaidOut };
}

function deleteEvent(eventId) {
  sportsDb.prepare('DELETE FROM sports_bets WHERE event_id = ?').run(eventId);
  sportsDb.prepare('DELETE FROM events WHERE id = ?').run(eventId);
}

function getSportsHouse() {
  return sportsDb.prepare('SELECT * FROM sports_house WHERE id = 1').get();
}

function setEventsBoardMessage(channelId, messageId) {
  const existing = sportsDb.prepare('SELECT * FROM events_board WHERE channel_id = ?').get(channelId);
  if (existing) {
    sportsDb.prepare('UPDATE events_board SET message_id = ? WHERE channel_id = ?').run(messageId, channelId);
  } else {
    sportsDb.prepare('INSERT INTO events_board (channel_id, message_id) VALUES (?, ?)').run(channelId, messageId);
  }
}

function getEventsBoardMessage(channelId) {
  return sportsDb.prepare('SELECT message_id FROM events_board WHERE channel_id = ?').get(channelId);
}

module.exports = {
  createEvent,
  updateEventMessageId,
  getActiveEvent,
  getLastActiveEvent,
  getChannelActiveEvents,
  getEventById,
  getEventByMessage,
  getAllActiveEvents,
  placeBet,
  getUserBet,
  getEventBets,
  closeEvent,
  finalizeEvent,
  deleteEvent,
  getSportsHouse,
  setEventsBoardMessage,
  getEventsBoardMessage
};
