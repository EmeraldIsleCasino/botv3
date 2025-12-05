const { giveawaysDb } = require('./index');

function createGiveaway(channelId, messageId, prize) {
  const result = giveawaysDb.prepare('INSERT INTO giveaways (channel_id, message_id, prize) VALUES (?, ?, ?)').run(channelId, messageId, prize);
  return result.lastInsertRowid;
}

function getActiveGiveaway(channelId) {
  return giveawaysDb.prepare("SELECT * FROM giveaways WHERE channel_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(channelId);
}

function getGiveawayByMessage(messageId) {
  return giveawaysDb.prepare('SELECT * FROM giveaways WHERE message_id = ?').get(messageId);
}

function addParticipant(giveawayId, userId) {
  try {
    giveawaysDb.prepare('INSERT INTO participants (giveaway_id, user_id) VALUES (?, ?)').run(giveawayId, userId);
    return true;
  } catch (e) {
    return false;
  }
}

function getParticipants(giveawayId) {
  return giveawaysDb.prepare('SELECT user_id FROM participants WHERE giveaway_id = ?').all(giveawayId);
}

function getParticipantCount(giveawayId) {
  const result = giveawaysDb.prepare('SELECT COUNT(*) as count FROM participants WHERE giveaway_id = ?').get(giveawayId);
  return result.count;
}

function isParticipant(giveawayId, userId) {
  const result = giveawaysDb.prepare('SELECT * FROM participants WHERE giveaway_id = ? AND user_id = ?').get(giveawayId, userId);
  return !!result;
}

function closeGiveaway(giveawayId, winnerId) {
  giveawaysDb.prepare("UPDATE giveaways SET status = 'closed', winner_id = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run(winnerId, giveawayId);
  if (winnerId) {
    const giveaway = giveawaysDb.prepare('SELECT prize FROM giveaways WHERE id = ?').get(giveawayId);
    giveawaysDb.prepare('INSERT INTO winners_history (user_id, prize, giveaway_id) VALUES (?, ?, ?)').run(winnerId, giveaway.prize, giveawayId);
  }
}

function deleteGiveaway(giveawayId) {
  giveawaysDb.prepare('DELETE FROM participants WHERE giveaway_id = ?').run(giveawayId);
  giveawaysDb.prepare('DELETE FROM giveaways WHERE id = ?').run(giveawayId);
}

function getAllActiveGiveaways() {
  return giveawaysDb.prepare("SELECT * FROM giveaways WHERE status = 'active'").all();
}

function getTopWinners(limit = 10) {
  return giveawaysDb.prepare(`
    SELECT user_id, COUNT(*) as wins 
    FROM winners_history 
    GROUP BY user_id 
    ORDER BY wins DESC 
    LIMIT ?
  `).all(limit);
}

module.exports = {
  createGiveaway,
  getActiveGiveaway,
  getGiveawayByMessage,
  getAllActiveGiveaways,
  addParticipant,
  getParticipants,
  getParticipantCount,
  isParticipant,
  closeGiveaway,
  deleteGiveaway,
  getTopWinners
};
