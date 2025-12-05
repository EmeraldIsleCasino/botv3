const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const economyDb = new Database(path.join(dbDir, "economy.db"));
const giveawaysDb = new Database(path.join(dbDir, "giveaways.db"));
const sportsDb = new Database(path.join(dbDir, "sports.db"));
const insideTrackDb = new Database(path.join(dbDir, "insidetrack.db"));
const slotsDb = new Database(path.join(dbDir, "slots.db"));
const blackjackDb = new Database(path.join(dbDir, "blackjack.db"));
const membershipsDb = new Database(path.join(dbDir, "memberships.db"));
const logsDb = new Database(path.join(dbDir, "logs.db"));
const dailyRewardsDb = new Database(path.join(dbDir, "daily_rewards.db"));
const tournamentsDb = new Database(path.join(dbDir, "tournaments.db"));
const configDb = new Database(path.join(dbDir, "config.db"));

function initializeDatabases() {
  economyDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      balance INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      total_lost INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      amount INTEGER,
      type TEXT,
      description TEXT,
      admin_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS house_funds (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_in INTEGER DEFAULT 0,
      total_out INTEGER DEFAULT 0
    );
  `);

  economyDb
    .prepare(
      "INSERT OR IGNORE INTO house_funds (id, total_in, total_out) VALUES (1, 0, 0)",
    )
    .run();

  giveawaysDb.exec(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      prize TEXT,
      status TEXT DEFAULT 'active',
      winner_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      giveaway_id INTEGER,
      user_id TEXT,
      UNIQUE(giveaway_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS winners_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      prize TEXT,
      giveaway_id INTEGER,
      won_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  sportsDb.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      title TEXT,
      sport TEXT,
      team1_name TEXT,
      team1_logo TEXT,
      team1_odds REAL,
      team2_name TEXT,
      team2_logo TEXT,
      team2_odds REAL,
      draw_odds REAL,
      status TEXT DEFAULT 'open',
      winner TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sports_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      user_id TEXT,
      team TEXT,
      amount INTEGER,
      potential_win INTEGER,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sports_house (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_bets INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      total_lost INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS events_board (
      channel_id TEXT PRIMARY KEY,
      message_id TEXT
    );
  `);

  sportsDb
    .prepare(
      "INSERT OR IGNORE INTO sports_house (id, total_bets, total_won, total_lost) VALUES (1, 0, 0, 0)",
    )
    .run();

  insideTrackDb.exec(`
    CREATE TABLE IF NOT EXISTS races (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id TEXT,
      message_id TEXT,
      horses TEXT,
      status TEXT DEFAULT 'betting',
      winner_horse TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS race_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      race_id INTEGER,
      user_id TEXT,
      horse_index INTEGER,
      amount INTEGER,
      odds REAL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inside_house (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_bets INTEGER DEFAULT 0,
      total_won INTEGER DEFAULT 0,
      total_lost INTEGER DEFAULT 0
    );
  `);

  insideTrackDb
    .prepare(
      "INSERT OR IGNORE INTO inside_house (id, total_bets, total_won, total_lost) VALUES (1, 0, 0, 0)",
    )
    .run();

  slotsDb.exec(`
    CREATE TABLE IF NOT EXISTS spins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      game TEXT,
      bet_amount INTEGER,
      result TEXT,
      payout INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS slots_house (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_wagered INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0
    );
  `);

  slotsDb
    .prepare(
      "INSERT OR IGNORE INTO slots_house (id, total_wagered, total_paid) VALUES (1, 0, 0)",
    )
    .run();

  blackjackDb.exec(`
    CREATE TABLE IF NOT EXISTS blackjack_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      bet INTEGER,
      result TEXT,
      payout INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS blackjack_house (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      total_wagered INTEGER DEFAULT 0,
      total_paid INTEGER DEFAULT 0
    );
  `);

  blackjackDb
    .prepare(
      "INSERT OR IGNORE INTO blackjack_house (id, total_wagered, total_paid) VALUES (1, 0, 0)",
    )
    .run();

  membershipsDb.exec(`
    CREATE TABLE IF NOT EXISTS memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      membership_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      expiration_date TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_user_id ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_expiration_date ON memberships(expiration_date);
    CREATE TABLE IF NOT EXISTS weekly_losses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      total_loss INTEGER DEFAULT 0,
      cashback_applied INTEGER DEFAULT 0,
      last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, week_start)
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_user ON weekly_losses(user_id);
    CREATE INDEX IF NOT EXISTS idx_weekly_start ON weekly_losses(week_start);
  `);

  // Initialize logs database
  logsDb.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      category TEXT DEFAULT 'general',
      admin_id TEXT,
      guild_id TEXT,
      channel_id TEXT,
      amount INTEGER,
      result TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_logs_user ON activity_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action);
    CREATE INDEX IF NOT EXISTS idx_logs_category ON activity_logs(category);
    CREATE INDEX IF NOT EXISTS idx_logs_created ON activity_logs(created_at);
  `);

  // Initialize daily rewards database
  dailyRewardsDb.exec(`
    CREATE TABLE IF NOT EXISTS daily_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      reward_date TEXT NOT NULL,
      streak_count INTEGER DEFAULT 1,
      reward_amount INTEGER NOT NULL,
      claimed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, reward_date)
    );
    CREATE TABLE IF NOT EXISTS user_streaks (
      user_id TEXT PRIMARY KEY,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_claim_date TEXT,
      total_claims INTEGER DEFAULT 0,
      total_earned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_daily_user ON daily_rewards(user_id);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_rewards(reward_date);
  `);

  // Initialize tournaments database
  tournamentsDb.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      game_type TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      max_participants INTEGER DEFAULT 50,
      entry_fee INTEGER DEFAULT 0,
      prize_pool INTEGER DEFAULT 0,
      winner_prize INTEGER DEFAULT 0,
      winner_id TEXT,
      active INTEGER DEFAULT 1,
      created_by TEXT,
      channel_id TEXT,
      message_id TEXT,
      start_time TEXT,
      end_time TEXT,
      rules TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tournament_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      score INTEGER DEFAULT 0,
      position INTEGER,
      UNIQUE(tournament_id, user_id),
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );
    CREATE TABLE IF NOT EXISTS tournament_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tournament_id INTEGER NOT NULL,
      game_id TEXT NOT NULL,
      player1_id TEXT NOT NULL,
      player2_id TEXT,
      winner_id TEXT,
      result TEXT,
      played_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
    );
    CREATE INDEX IF NOT EXISTS idx_tournament_status ON tournaments(status);
    CREATE INDEX IF NOT EXISTS idx_tournament_game ON tournaments(game_type);
    CREATE INDEX IF NOT EXISTS idx_participants_tournament ON tournament_participants(tournament_id);
    CREATE INDEX IF NOT EXISTS idx_games_tournament ON tournament_games(tournament_id);
  `);

  // Initialize dynamic config database
  configDb.exec(`
    CREATE TABLE IF NOT EXISTS config_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      type TEXT DEFAULT 'string',
      description TEXT,
      category TEXT DEFAULT 'general',
      updated_by TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS config_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT NOT NULL,
      changed_by TEXT,
      changed_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_config_key ON config_settings(key);
    CREATE INDEX IF NOT EXISTS idx_config_category ON config_settings(category);
    CREATE INDEX IF NOT EXISTS idx_config_history_key ON config_history(key);
  `);

  // Initialize default config values
  const defaultConfigs = [
    { key: 'casino_name', value: 'Emerald Isle Casino ®', type: 'string', description: 'Nombre del casino', category: 'general' },
    { key: 'currency_symbol', value: '💎', type: 'string', description: 'Símbolo de moneda', category: 'economy' },
    { key: 'min_bet', value: '100', type: 'number', description: 'Apuesta mínima', category: 'gambling' },
    { key: 'max_bet', value: '5000', type: 'number', description: 'Apuesta máxima por defecto', category: 'gambling' },
    { key: 'house_edge', value: '0.05', type: 'number', description: 'Ventaja de la casa (5%)', category: 'gambling' },
    { key: 'daily_reward_base', value: '500', type: 'number', description: 'Recompensa diaria base', category: 'rewards' },
    { key: 'daily_reward_streak_bonus', value: '100', type: 'number', description: 'Bonificación por racha diaria', category: 'rewards' },
    { key: 'tournament_default_fee', value: '1000', type: 'number', description: 'Cuota de entrada por defecto', category: 'tournaments' },
    { key: 'logs_retention_days', value: '30', type: 'number', description: 'Días para mantener logs', category: 'logging' },
    { key: 'auto_save_interval', value: '60000', type: 'number', description: 'Intervalo de autoguardado (ms)', category: 'system' }
  ];

  for (const config of defaultConfigs) {
    configDb
      .prepare(
        `INSERT OR IGNORE INTO config_settings (key, value, type, description, category) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(config.key, config.value, config.type, config.description, config.category);
  }

  console.log("[Database] All databases initialized successfully.");
}

function saveAllDatabases() {
  try {
    economyDb.pragma("wal_checkpoint(TRUNCATE)");
    giveawaysDb.pragma("wal_checkpoint(TRUNCATE)");
    sportsDb.pragma("wal_checkpoint(TRUNCATE)");
    insideTrackDb.pragma("wal_checkpoint(TRUNCATE)");
    slotsDb.pragma("wal_checkpoint(TRUNCATE)");
    blackjackDb.pragma("wal_checkpoint(TRUNCATE)");
    membershipsDb.pragma("wal_checkpoint(TRUNCATE)");
    logsDb.pragma("wal_checkpoint(TRUNCATE)");
    dailyRewardsDb.pragma("wal_checkpoint(TRUNCATE)");
    tournamentsDb.pragma("wal_checkpoint(TRUNCATE)");
    configDb.pragma("wal_checkpoint(TRUNCATE)");
    console.log("[Autoping] Bases de datos guardadas correctamente.");
    return true;
  } catch (error) {
    console.error("[Autoping] Error saving databases:", error);
    return false;
  }
}

module.exports = {
  economyDb,
  giveawaysDb,
  sportsDb,
  insideTrackDb,
  slotsDb,
  blackjackDb,
  membershipsDb,
  logsDb,
  dailyRewardsDb,
  tournamentsDb,
  configDb,
  initializeDatabases,
  saveAllDatabases,
};
