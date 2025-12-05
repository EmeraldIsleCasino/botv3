const { insideTrackDb } = require('./index');

function createRace(channelId, messageId, horses) {
  const result = insideTrackDb.prepare('INSERT INTO races (channel_id, message_id, horses) VALUES (?, ?, ?)').run(channelId, messageId, JSON.stringify(horses));
  return result.lastInsertRowid;
}

function getActiveRace(channelId) {
  return insideTrackDb.prepare("SELECT * FROM races WHERE channel_id = ? AND status = 'betting' ORDER BY id DESC LIMIT 1").get(channelId);
}

function getActiveRaces() {
  return insideTrackDb.prepare("SELECT * FROM races WHERE status = 'betting'").all();
}

function getRaceById(raceId) {
  const race = insideTrackDb.prepare('SELECT * FROM races WHERE id = ?').get(raceId);
  if (race) race.horses = JSON.parse(race.horses);
  return race;
}

function getRaceByMessage(messageId) {
  const race = insideTrackDb.prepare('SELECT * FROM races WHERE message_id = ?').get(messageId);
  if (race) race.horses = JSON.parse(race.horses);
  return race;
}

function placeBet(raceId, userId, horseIndex, amount, odds) {
  insideTrackDb.prepare('INSERT INTO race_bets (race_id, user_id, horse_index, amount, odds) VALUES (?, ?, ?, ?, ?)').run(raceId, userId, horseIndex, amount, odds);
  insideTrackDb.prepare('UPDATE inside_house SET total_bets = total_bets + ? WHERE id = 1').run(amount);
}

function getUserBet(raceId, userId) {
  return insideTrackDb.prepare('SELECT * FROM race_bets WHERE race_id = ? AND user_id = ?').get(raceId, userId);
}

function getRaceBets(raceId) {
  return insideTrackDb.prepare('SELECT * FROM race_bets WHERE race_id = ?').all(raceId);
}

function startRace(raceId) {
  insideTrackDb.prepare("UPDATE races SET status = 'racing' WHERE id = ?").run(raceId);
}

function finishRace(raceId, winnerHorseIndex) {
  insideTrackDb.prepare("UPDATE races SET status = 'finished', winner_horse = ? WHERE id = ?").run(winnerHorseIndex, raceId);
  
  const winningBets = insideTrackDb.prepare('SELECT * FROM race_bets WHERE race_id = ? AND horse_index = ?').all(raceId, winnerHorseIndex);
  const losingBets = insideTrackDb.prepare('SELECT * FROM race_bets WHERE race_id = ? AND horse_index != ?').all(raceId, winnerHorseIndex);
  
  let totalPaidOut = 0;
  winningBets.forEach(bet => {
    const winAmount = Math.floor(bet.amount * bet.odds);
    insideTrackDb.prepare("UPDATE race_bets SET status = 'won' WHERE id = ?").run(bet.id);
    totalPaidOut += winAmount;
  });
  
  let totalWonByHouse = 0;
  losingBets.forEach(bet => {
    insideTrackDb.prepare("UPDATE race_bets SET status = 'lost' WHERE id = ?").run(bet.id);
    totalWonByHouse += bet.amount;
  });
  
  insideTrackDb.prepare('UPDATE inside_house SET total_won = total_won + ?, total_lost = total_lost + ? WHERE id = 1').run(totalWonByHouse, totalPaidOut);
  
  return { winningBets, losingBets, totalPaidOut };
}

function deleteRace(raceId) {
  insideTrackDb.prepare('DELETE FROM race_bets WHERE race_id = ?').run(raceId);
  insideTrackDb.prepare('DELETE FROM races WHERE id = ?').run(raceId);
}

function getInsideHouse() {
  return insideTrackDb.prepare('SELECT * FROM inside_house WHERE id = 1').get();
}

module.exports = {
  createRace,
  getActiveRace,
  getActiveRaces,
  getRaceById,
  getRaceByMessage,
  placeBet,
  getUserBet,
  getRaceBets,
  startRace,
  finishRace,
  deleteRace,
  getInsideHouse
};
