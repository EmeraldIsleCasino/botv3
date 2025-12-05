const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const minigamesDb = new Database(path.join(dbDir, "minigames.db"));

function initializeMinigamesDb() {
  minigamesDb.exec(`
    CREATE TABLE IF NOT EXISTS mines_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      bet INTEGER NOT NULL,
      grid_size INTEGER DEFAULT 25,
      mines_count INTEGER NOT NULL,
      mines_positions TEXT NOT NULL,
      revealed_cells TEXT DEFAULT '[]',
      state TEXT DEFAULT 'active',
      multiplier REAL DEFAULT 1.0,
      cashout INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jackpot_pots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room TEXT NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      status TEXT DEFAULT 'open',
      total_bet INTEGER DEFAULT 0,
      winner_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS jackpot_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pot_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      ticket_from INTEGER NOT NULL,
      ticket_to INTEGER NOT NULL,
      FOREIGN KEY (pot_id) REFERENCES jackpot_pots(id)
    );

    CREATE TABLE IF NOT EXISTS arena_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_id TEXT NOT NULL,
      player2_id TEXT,
      stakes INTEGER NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      p1_hp INTEGER DEFAULT 100,
      p2_hp INTEGER DEFAULT 100,
      current_turn TEXT,
      state TEXT DEFAULT 'waiting',
      winner_id TEXT,
      log TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crash_races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      seed TEXT,
      crash_point REAL,
      status TEXT DEFAULT 'betting',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS crash_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      cashout_at REAL,
      result TEXT DEFAULT 'pending',
      payout INTEGER DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES crash_races(id)
    );

    CREATE TABLE IF NOT EXISTS boxing_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_id TEXT NOT NULL,
      player2_id TEXT,
      stakes INTEGER NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      p1_hp INTEGER DEFAULT 100,
      p2_hp INTEGER DEFAULT 100,
      p1_stamina INTEGER DEFAULT 100,
      p2_stamina INTEGER DEFAULT 100,
      current_turn TEXT,
      round INTEGER DEFAULT 1,
      state TEXT DEFAULT 'waiting',
      winner_id TEXT,
      log TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS penalty_matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player1_id TEXT NOT NULL,
      player2_id TEXT,
      stakes INTEGER NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      p1_score INTEGER DEFAULT 0,
      p2_score INTEGER DEFAULT 0,
      current_round INTEGER DEFAULT 1,
      current_shooter TEXT,
      state TEXT DEFAULT 'waiting',
      winner_id TEXT,
      log TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wheel_spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      bet INTEGER NOT NULL,
      sector INTEGER,
      multiplier REAL,
      payout INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS heist_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leader_id TEXT NOT NULL,
      stakes INTEGER NOT NULL,
      channel_id TEXT,
      message_id TEXT,
      stage TEXT DEFAULT 'recruiting',
      success INTEGER,
      loot INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS heist_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      heist_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT DEFAULT 'ready',
      FOREIGN KEY (heist_id) REFERENCES heist_games(id),
      UNIQUE(heist_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS duck_races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      seed TEXT,
      winner_duck INTEGER,
      status TEXT DEFAULT 'betting',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS duck_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      duck INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      odds REAL NOT NULL,
      result TEXT DEFAULT 'pending',
      payout INTEGER DEFAULT 0,
      FOREIGN KEY (race_id) REFERENCES duck_races(id)
    );

    CREATE TABLE IF NOT EXISTS tower_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      bet INTEGER NOT NULL,
      current_floor INTEGER DEFAULT 0,
      multiplier REAL DEFAULT 1.0,
      state TEXT DEFAULT 'active',
      cashout INTEGER DEFAULT 0,
      path TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS minigame_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      game TEXT NOT NULL,
      total_played INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      total_lost INTEGER DEFAULT 0,
      total_wagered INTEGER DEFAULT 0,
      total_payout INTEGER DEFAULT 0,
      biggest_win INTEGER DEFAULT 0,
      UNIQUE(user_id, game)
    );

    CREATE TABLE IF NOT EXISTS minigame_house (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_wagered INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_mines_user ON mines_games(user_id);
    CREATE INDEX IF NOT EXISTS idx_mines_state ON mines_games(state);
    CREATE INDEX IF NOT EXISTS idx_jackpot_status ON jackpot_pots(status);
    CREATE INDEX IF NOT EXISTS idx_arena_state ON arena_matches(state);
    CREATE INDEX IF NOT EXISTS idx_crash_status ON crash_races(status);
    CREATE INDEX IF NOT EXISTS idx_boxing_state ON boxing_matches(state);
    CREATE INDEX IF NOT EXISTS idx_penalty_state ON penalty_matches(state);
    CREATE INDEX IF NOT EXISTS idx_heist_stage ON heist_games(stage);
    CREATE INDEX IF NOT EXISTS idx_duck_status ON duck_races(status);
    CREATE INDEX IF NOT EXISTS idx_tower_state ON tower_runs(state);
  `);

  minigamesDb.prepare("INSERT OR IGNORE INTO minigame_house (id, total_wagered, total_paid) VALUES (1, 0, 0)").run();

  console.log("[Database] Minigames database initialized successfully.");
}

function updateStats(userId, game, wagered, payout, won) {
  const existing = minigamesDb.prepare(
    "SELECT * FROM minigame_stats WHERE user_id = ? AND game = ?"
  ).get(userId, game);

  if (existing) {
    minigamesDb.prepare(`
      UPDATE minigame_stats SET
        total_played = total_played + 1,
        total_won = total_won + ?,
        total_lost = total_lost + ?,
        total_wagered = total_wagered + ?,
        total_payout = total_payout + ?,
        biggest_win = MAX(biggest_win, ?)
      WHERE user_id = ? AND game = ?
    `).run(won ? 1 : 0, won ? 0 : 1, wagered, payout, payout, userId, game);
  } else {
    minigamesDb.prepare(`
      INSERT INTO minigame_stats (user_id, game, total_played, total_won, total_lost, total_wagered, total_payout, biggest_win)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
    `).run(userId, game, won ? 1 : 0, won ? 0 : 1, wagered, payout, payout);
  }

  minigamesDb.prepare(
    "UPDATE minigame_house SET total_wagered = total_wagered + ?, total_paid = total_paid + ? WHERE id = 1"
  ).run(wagered, payout);
}

function getPlayerStats(userId, game) {
  return minigamesDb.prepare(
    "SELECT * FROM minigame_stats WHERE user_id = ? AND game = ?"
  ).get(userId, game);
}

function getAllPlayerStats(userId) {
  return minigamesDb.prepare(
    "SELECT * FROM minigame_stats WHERE user_id = ?"
  ).all(userId);
}

function getHouseStats() {
  return minigamesDb.prepare("SELECT * FROM minigame_house WHERE id = 1").get();
}

function saveMinigamesDb() {
  try {
    minigamesDb.pragma("wal_checkpoint(TRUNCATE)");
    return true;
  } catch (error) {
    console.error("[Minigames] Error saving database:", error);
    return false;
  }
}

initializeMinigamesDb();

module.exports = {
  minigamesDb,
  initializeMinigamesDb,
  updateStats,
  getPlayerStats,
  getAllPlayerStats,
  getHouseStats,
  saveMinigamesDb
};
