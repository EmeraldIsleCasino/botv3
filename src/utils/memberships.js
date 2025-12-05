const memberships = require("../database/memberships");

const MEMBERSHIP_TYPES = {
  silver: {
    name: "Silver",
    emoji: "🥈",
    price: 100000,
    color: 0xc0c0c0,
    benefits: [
      "💰 10% de bonificación en depósitos",
      "💵 5% de cashback semanal en pérdidas",
      "🎯 +5% en ganancias potenciales de apuestas",
      "🎰 Límite de apuesta hasta $7,500",
      "🏆 Ranking especial en estadísticas",
      "💎 Soporte prioritario",
    ],
    depositBonus: 0.1,
    minBet: 100,
    maxBet: 7500,
    cashbackRate: 0.05, // 5% cashback semanal
    betBonus: 1.05, // +5% en ganancias potenciales
  },
  gold: {
    name: "Gold",
    emoji: "🥇",
    price: 150000,
    color: 0xffd700,
    benefits: [
      "💰 20% de bonificación en depósitos",
      "💵 10% de cashback semanal en pérdidas",
      "🎯 +10% en ganancias potenciales de apuestas",
      "🎰 Límite de apuesta hasta $10,000",
      "🎲 Apuestas especiales en mesas",
      "🏆 Ranking VIP en estadísticas",
      "💎 Soporte prioritario 24/7",
      "🎁 Acceso a sorteos exclusivos",
    ],
    depositBonus: 0.2,
    minBet: 100,
    maxBet: 10000,
    cashbackRate: 0.1, // 10% cashback semanal
    betBonus: 1.1, // +10% en ganancias potenciales
  },
  platinum: {
    name: "Platinum",
    emoji: "💎",
    price: 300000,
    color: 0xe5e4e2,
    benefits: [
      "💰 30% de bonificación en depósitos",
      "💵 15% de cashback semanal en pérdidas",
      "🎯 +15% en ganancias potenciales de apuestas",
      "🎰 Límite de apuesta hasta $15,000",
      "🎲 Apuestas ilimitadas en mesas",
      "🏆 Ranking ÉLITE en estadísticas",
      "💎 Soporte VIP 24/7",
      "🎁 Acceso exclusivo a sorteos premium",
      "👑 Badge especial en el servidor",
      "🚀 Acceso anticipado a nuevas funciones",
    ],
    depositBonus: 0.3,
    minBet: 100,
    maxBet: 15000,
    cashbackRate: 0.15, // 15% cashback semanal
    betBonus: 1.15, // +15% en ganancias potenciales
  },
};

function getMembershipType(type) {
  return MEMBERSHIP_TYPES[type.toLowerCase()];
}

function isExpired(membership) {
  if (!membership || !membership.active) return true;
  const expirationDate = new Date(membership.expiration_date);
  const now = new Date();
  return expirationDate < now;
}

function calculateExpirationDate(startDate, days = 7) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function formatMembershipType(type) {
  const membership = getMembershipType(type);
  return membership ? `${membership.emoji} ${membership.name}` : type;
}

function getUserMembership(userId) {
  const membership = memberships.getMembership(userId);
  if (!membership) return null;

  if (isExpired(membership)) {
    memberships.expireMembership(userId);
    return null;
  }

  return membership;
}

function hasActiveMembership(userId) {
  const membership = getUserMembership(userId);
  return membership !== null;
}

function getDepositBonus(userId) {
  const membership = getUserMembership(userId);
  if (!membership) return 0;

  const type = membership.membership_type.toLowerCase();
  const bonuses = {
    silver: 0.1, // 10%
    gold: 0.2, // 20%
    platinum: 0.3, // 30%
  };

  return bonuses[type] || 0;
}

function getMaxBetLimit(userId) {
  const membership = getUserMembership(userId);
  if (!membership) return 5000; // Default

  const type = membership.membership_type.toLowerCase();
  const limits = {
    silver: 7500,
    gold: 10000,
    platinum: 15000,
  };

  return limits[type] || 5000;
}

function getMinBetLimit(userId) {
  return 100; // Mínimo siempre es 100 para todos
}

function getCashbackRate(userId) {
  const membership = getUserMembership(userId);
  if (!membership) return 0;

  const type = membership.membership_type.toLowerCase();
  return MEMBERSHIP_TYPES[type]?.cashbackRate || 0;
}

function calculateCashback(userId, weeklyLoss) {
  const rate = getCashbackRate(userId);
  if (rate === 0 || weeklyLoss <= 0) return 0;

  return Math.floor(weeklyLoss * rate);
}

function getBetBonus(userId) {
  const membership = getUserMembership(userId);
  if (!membership) return 1.0; // Sin bono

  const type = membership.membership_type.toLowerCase();
  return MEMBERSHIP_TYPES[type]?.betBonus || 1.0;
}

function applyBetBonus(userId, potentialWin) {
  const bonus = getBetBonus(userId);
  return Math.floor(potentialWin * bonus);
}

module.exports = {
  MEMBERSHIP_TYPES,
  getMembershipType,
  isExpired,
  calculateExpirationDate,
  formatMembershipType,
  getUserMembership,
  hasActiveMembership,
  getDepositBonus,
  getMaxBetLimit,
  getMinBetLimit,
  getCashbackRate,
  calculateCashback,
  getBetBonus,
  applyBetBonus,
};
