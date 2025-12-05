const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const nftsDb = new Database(path.join(dbDir, "nfts.db"));

function initializeNftsDb() {
  nftsDb.exec(`
    CREATE TABLE IF NOT EXISTS nft_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      rarity TEXT NOT NULL,
      position TEXT,
      club TEXT,
      nation TEXT,
      overall INTEGER DEFAULT 0,
      stats TEXT DEFAULT '{}',
      price INTEGER DEFAULT 0,
      supply INTEGER DEFAULT -1,
      minted INTEGER DEFAULT 0,
      drop_weight REAL DEFAULT 1.0,
      image_url TEXT,
      bonus_type TEXT DEFAULT 'winnings',
      bonus_value REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_nfts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      equipped INTEGER DEFAULT 0,
      acquired_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, card_id),
      FOREIGN KEY (card_id) REFERENCES nft_cards(id)
    );

    CREATE TABLE IF NOT EXISTS nft_drops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      source TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES nft_cards(id)
    );

    CREATE TABLE IF NOT EXISTS nft_shop_settings (
      rarity TEXT PRIMARY KEY,
      base_price INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS nft_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      amount INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_nfts_user ON user_nfts(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_nfts_equipped ON user_nfts(equipped);
    CREATE INDEX IF NOT EXISTS idx_nft_drops_user ON nft_drops(user_id);
    CREATE INDEX IF NOT EXISTS idx_nft_cards_rarity ON nft_cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_nft_cards_active ON nft_cards(active);
  `);

  const defaultShopSettings = [
    { rarity: 'common', base_price: 500, enabled: 1 },
    { rarity: 'rare', base_price: 2000, enabled: 1 },
    { rarity: 'epic', base_price: 5000, enabled: 1 },
    { rarity: 'legendary', base_price: 15000, enabled: 1 },
    { rarity: 'mythic', base_price: 50000, enabled: 1 }
  ];

  for (const setting of defaultShopSettings) {
    nftsDb.prepare(
      "INSERT OR IGNORE INTO nft_shop_settings (rarity, base_price, enabled) VALUES (?, ?, ?)"
    ).run(setting.rarity, setting.base_price, setting.enabled);
  }

  initializeDefaultCards();

  console.log("[Database] NFTs database initialized successfully.");
}

function initializeDefaultCards() {
  const defaultCards = [
    { slug: 'messi', name: 'Lionel Messi', rarity: 'mythic', position: 'RW', club: 'Inter Miami', nation: 'Argentina', overall: 91, bonus_type: 'winnings', bonus_value: 0.15, price: 50000, drop_weight: 0.01 },
    { slug: 'ronaldo', name: 'Cristiano Ronaldo', rarity: 'mythic', position: 'ST', club: 'Al Nassr', nation: 'Portugal', overall: 88, bonus_type: 'winnings', bonus_value: 0.15, price: 50000, drop_weight: 0.01 },
    { slug: 'mbappe', name: 'Kylian Mbappé', rarity: 'legendary', position: 'ST', club: 'Real Madrid', nation: 'Francia', overall: 91, bonus_type: 'winnings', bonus_value: 0.12, price: 20000, drop_weight: 0.02 },
    { slug: 'haaland', name: 'Erling Haaland', rarity: 'legendary', position: 'ST', club: 'Man City', nation: 'Noruega', overall: 91, bonus_type: 'winnings', bonus_value: 0.12, price: 20000, drop_weight: 0.02 },
    { slug: 'bellingham', name: 'Jude Bellingham', rarity: 'legendary', position: 'CM', club: 'Real Madrid', nation: 'Inglaterra', overall: 89, bonus_type: 'luck', bonus_value: 0.05, price: 18000, drop_weight: 0.025 },
    { slug: 'vinicius', name: 'Vinicius Jr', rarity: 'epic', position: 'LW', club: 'Real Madrid', nation: 'Brasil', overall: 89, bonus_type: 'winnings', bonus_value: 0.08, price: 8000, drop_weight: 0.04 },
    { slug: 'salah', name: 'Mohamed Salah', rarity: 'epic', position: 'RW', club: 'Liverpool', nation: 'Egipto', overall: 89, bonus_type: 'winnings', bonus_value: 0.08, price: 7500, drop_weight: 0.04 },
    { slug: 'debruyne', name: 'Kevin De Bruyne', rarity: 'epic', position: 'CM', club: 'Man City', nation: 'Bélgica', overall: 88, bonus_type: 'luck', bonus_value: 0.04, price: 7000, drop_weight: 0.045 },
    { slug: 'neymar', name: 'Neymar Jr', rarity: 'epic', position: 'LW', club: 'Al Hilal', nation: 'Brasil', overall: 86, bonus_type: 'winnings', bonus_value: 0.08, price: 6500, drop_weight: 0.045 },
    { slug: 'modric', name: 'Luka Modrić', rarity: 'epic', position: 'CM', club: 'Real Madrid', nation: 'Croacia', overall: 85, bonus_type: 'luck', bonus_value: 0.04, price: 6000, drop_weight: 0.05 },
    { slug: 'pedri', name: 'Pedri', rarity: 'rare', position: 'CM', club: 'Barcelona', nation: 'España', overall: 86, bonus_type: 'winnings', bonus_value: 0.05, price: 3000, drop_weight: 0.08 },
    { slug: 'saka', name: 'Bukayo Saka', rarity: 'rare', position: 'RW', club: 'Arsenal', nation: 'Inglaterra', overall: 86, bonus_type: 'winnings', bonus_value: 0.05, price: 2800, drop_weight: 0.08 },
    { slug: 'rodri', name: 'Rodri', rarity: 'rare', position: 'CDM', club: 'Man City', nation: 'España', overall: 89, bonus_type: 'luck', bonus_value: 0.03, price: 3200, drop_weight: 0.07 },
    { slug: 'foden', name: 'Phil Foden', rarity: 'rare', position: 'LW', club: 'Man City', nation: 'Inglaterra', overall: 87, bonus_type: 'winnings', bonus_value: 0.05, price: 2700, drop_weight: 0.08 },
    { slug: 'yamal', name: 'Lamine Yamal', rarity: 'rare', position: 'RW', club: 'Barcelona', nation: 'España', overall: 81, bonus_type: 'luck', bonus_value: 0.03, price: 2500, drop_weight: 0.09 },
    { slug: 'palmer', name: 'Cole Palmer', rarity: 'common', position: 'CAM', club: 'Chelsea', nation: 'Inglaterra', overall: 84, bonus_type: 'winnings', bonus_value: 0.02, price: 800, drop_weight: 0.15 },
    { slug: 'wirtz', name: 'Florian Wirtz', rarity: 'common', position: 'CAM', club: 'Leverkusen', nation: 'Alemania', overall: 85, bonus_type: 'winnings', bonus_value: 0.02, price: 750, drop_weight: 0.15 },
    { slug: 'gavi', name: 'Gavi', rarity: 'common', position: 'CM', club: 'Barcelona', nation: 'España', overall: 82, bonus_type: 'luck', bonus_value: 0.01, price: 600, drop_weight: 0.18 },
    { slug: 'valverde', name: 'Federico Valverde', rarity: 'common', position: 'CM', club: 'Real Madrid', nation: 'Uruguay', overall: 87, bonus_type: 'winnings', bonus_value: 0.02, price: 700, drop_weight: 0.16 },
    { slug: 'kvaratskhelia', name: 'Khvicha Kvaratskhelia', rarity: 'common', position: 'LW', club: 'Napoli', nation: 'Georgia', overall: 84, bonus_type: 'winnings', bonus_value: 0.02, price: 650, drop_weight: 0.17 }
  ];

  const stmt = nftsDb.prepare(`
    INSERT OR IGNORE INTO nft_cards (slug, name, rarity, position, club, nation, overall, bonus_type, bonus_value, price, drop_weight, stats)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}')
  `);

  for (const card of defaultCards) {
    stmt.run(card.slug, card.name, card.rarity, card.position, card.club, card.nation, card.overall, card.bonus_type, card.bonus_value, card.price, card.drop_weight);
  }
}

function getAllCards() {
  return nftsDb.prepare("SELECT * FROM nft_cards WHERE active = 1 ORDER BY rarity DESC, overall DESC").all();
}

function getCardBySlug(slug) {
  return nftsDb.prepare("SELECT * FROM nft_cards WHERE slug = ?").get(slug);
}

function getCardById(id) {
  return nftsDb.prepare("SELECT * FROM nft_cards WHERE id = ?").get(id);
}

function getCardsByRarity(rarity) {
  return nftsDb.prepare("SELECT * FROM nft_cards WHERE rarity = ? AND active = 1").all(rarity);
}

function getUserCards(userId) {
  return nftsDb.prepare(`
    SELECT un.*, nc.slug, nc.name, nc.rarity, nc.position, nc.club, nc.nation, nc.overall, nc.bonus_type, nc.bonus_value, nc.image_url
    FROM user_nfts un
    JOIN nft_cards nc ON un.card_id = nc.id
    WHERE un.user_id = ?
    ORDER BY nc.rarity DESC, nc.overall DESC
  `).all(userId);
}

function getUserEquippedCard(userId) {
  return nftsDb.prepare(`
    SELECT un.*, nc.slug, nc.name, nc.rarity, nc.position, nc.club, nc.nation, nc.overall, nc.bonus_type, nc.bonus_value, nc.image_url
    FROM user_nfts un
    JOIN nft_cards nc ON un.card_id = nc.id
    WHERE un.user_id = ? AND un.equipped = 1
  `).get(userId);
}

function grantCard(userId, cardId, source = 'drop') {
  const existing = nftsDb.prepare(
    "SELECT * FROM user_nfts WHERE user_id = ? AND card_id = ?"
  ).get(userId, cardId);

  if (existing) {
    nftsDb.prepare(
      "UPDATE user_nfts SET quantity = quantity + 1 WHERE user_id = ? AND card_id = ?"
    ).run(userId, cardId);
  } else {
    nftsDb.prepare(
      "INSERT INTO user_nfts (user_id, card_id, quantity, equipped) VALUES (?, ?, 1, 0)"
    ).run(userId, cardId);
  }

  nftsDb.prepare(
    "INSERT INTO nft_drops (user_id, card_id, source) VALUES (?, ?, ?)"
  ).run(userId, cardId, source);

  nftsDb.prepare(
    "UPDATE nft_cards SET minted = minted + 1 WHERE id = ?"
  ).run(cardId);

  return getCardById(cardId);
}

function equipCard(userId, cardId) {
  nftsDb.prepare("UPDATE user_nfts SET equipped = 0 WHERE user_id = ?").run(userId);

  const result = nftsDb.prepare(
    "UPDATE user_nfts SET equipped = 1 WHERE user_id = ? AND card_id = ?"
  ).run(userId, cardId);

  return result.changes > 0;
}

function unequipCard(userId) {
  nftsDb.prepare("UPDATE user_nfts SET equipped = 0 WHERE user_id = ?").run(userId);
}

function hasCard(userId, cardId) {
  const result = nftsDb.prepare(
    "SELECT quantity FROM user_nfts WHERE user_id = ? AND card_id = ?"
  ).get(userId, cardId);
  return result && result.quantity > 0;
}

function getUserBonus(userId) {
  const equipped = getUserEquippedCard(userId);
  if (!equipped) {
    return { type: null, value: 0 };
  }
  return {
    type: equipped.bonus_type,
    value: equipped.bonus_value,
    card: equipped
  };
}

function applyNftBonus(userId, baseAmount, isWin = true) {
  const bonus = getUserBonus(userId);
  if (!bonus.type || !isWin) return baseAmount;

  if (bonus.type === 'winnings') {
    return Math.floor(baseAmount * (1 + bonus.value));
  }
  return baseAmount;
}

function getNftLuckBonus(userId) {
  const bonus = getUserBonus(userId);
  if (bonus.type === 'luck') {
    return bonus.value;
  }
  return 0;
}

const RARITY_DROP_CHANCES = {
  common: 0.10,
  rare: 0.05,
  epic: 0.02,
  legendary: 0.008,
  mythic: 0.002
};

function maybeDrop(userId, sourceGame) {
  const roll = Math.random();

  let currentThreshold = 0;
  let targetRarity = null;

  for (const [rarity, chance] of Object.entries(RARITY_DROP_CHANCES)) {
    currentThreshold += chance;
    if (roll < currentThreshold) {
      targetRarity = rarity;
      break;
    }
  }

  if (!targetRarity) return null;

  const cards = getCardsByRarity(targetRarity);
  if (cards.length === 0) return null;

  const totalWeight = cards.reduce((sum, card) => sum + card.drop_weight, 0);
  let weightRoll = Math.random() * totalWeight;

  for (const card of cards) {
    weightRoll -= card.drop_weight;
    if (weightRoll <= 0) {
      return grantCard(userId, card.id, sourceGame);
    }
  }

  return grantCard(userId, cards[0].id, sourceGame);
}

function getShopSettings() {
  return nftsDb.prepare("SELECT * FROM nft_shop_settings").all();
}

function setShopPrice(rarity, price) {
  nftsDb.prepare(
    "UPDATE nft_shop_settings SET base_price = ? WHERE rarity = ?"
  ).run(price, rarity);
}

function getShopCards() {
  return nftsDb.prepare(`
    SELECT nc.*, nss.enabled as shop_enabled
    FROM nft_cards nc
    JOIN nft_shop_settings nss ON nc.rarity = nss.rarity
    WHERE nc.active = 1 AND nss.enabled = 1
    ORDER BY nc.rarity DESC, nc.overall DESC
  `).all();
}

function addCard(cardData) {
  return nftsDb.prepare(`
    INSERT INTO nft_cards (slug, name, rarity, position, club, nation, overall, bonus_type, bonus_value, price, drop_weight, stats, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cardData.slug, cardData.name, cardData.rarity, cardData.position,
    cardData.club, cardData.nation, cardData.overall, cardData.bonus_type || 'winnings',
    cardData.bonus_value || 0, cardData.price || 0, cardData.drop_weight || 1.0,
    JSON.stringify(cardData.stats || {}), cardData.image_url || null
  );
}

function removeCard(slug) {
  return nftsDb.prepare("UPDATE nft_cards SET active = 0 WHERE slug = ?").run(slug);
}

function setCardPrice(slug, price) {
  return nftsDb.prepare("UPDATE nft_cards SET price = ? WHERE slug = ?").run(price, slug);
}

function getCardOwners(cardId) {
  return nftsDb.prepare(`
    SELECT user_id, quantity, equipped FROM user_nfts WHERE card_id = ? AND quantity > 0
  `).all(cardId);
}

function saveNftsDb() {
  try {
    nftsDb.pragma("wal_checkpoint(TRUNCATE)");
    return true;
  } catch (error) {
    console.error("[NFTs] Error saving database:", error);
    return false;
  }
}

initializeNftsDb();

module.exports = {
  nftsDb,
  initializeNftsDb,
  getAllCards,
  getCardBySlug,
  getCardById,
  getCardsByRarity,
  getUserCards,
  getUserEquippedCard,
  grantCard,
  equipCard,
  unequipCard,
  hasCard,
  getUserBonus,
  applyNftBonus,
  getNftLuckBonus,
  maybeDrop,
  getShopSettings,
  setShopPrice,
  getShopCards,
  addCard,
  removeCard,
  setCardPrice,
  getCardOwners,
  saveNftsDb,
  RARITY_DROP_CHANCES
};
