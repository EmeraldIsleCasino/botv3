const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANK_VALUES = { A: 14, K: 13, Q: 12, J: 11, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };
const SUIT_EMOJI = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣' };

const games = new Map();

function createDeck() {
  const d = [];
  for (let s of SUITS) for (let r of RANKS) d.push({ r, s });
  return d.sort(() => Math.random() - 0.5);
}

function drawCard(deck) {
  if (deck.length < 10) Object.assign(deck, createDeck());
  return deck.pop();
}

function rankHand(hand) {
  const vals = hand.map(c => RANK_VALUES[c.r]).sort((a, b) => b - a);
  const suits = hand.map(c => c.s);
  const ranks = hand.map(c => c.r);
  
  const isFlush = suits.every(s => s === suits[0]);
  const isStraight = vals[0] - vals[4] === 4 && new Set(vals).size === 5;
  
  const counts = {};
  ranks.forEach(r => counts[r] = (counts[r] || 0) + 1);
  const sorted = Object.values(counts).sort((a, b) => b - a);
  
  let type = 0, val = 0;
  if (isStraight && isFlush) { type = 8; val = vals[0]; }
  else if (sorted[0] === 4) { type = 7; val = vals[0]; }
  else if (sorted[0] === 3 && sorted[1] === 2) { type = 6; val = vals[0]; }
  else if (isFlush) { type = 5; val = vals[0]; }
  else if (isStraight) { type = 4; val = vals[0]; }
  else if (sorted[0] === 3) { type = 3; val = vals[0]; }
  else if (sorted[0] === 2 && sorted[1] === 2) { type = 2; val = Math.max(...vals.filter((_, i) => ranks.indexOf(Object.keys(counts).find(k => counts[k] === 2)) >= 0)); }
  else if (sorted[0] === 2) { type = 1; val = vals[0]; }
  else { type = 0; val = vals[0]; }
  
  return { type, val };
}

function compareHands(p, d) {
  const pRank = rankHand(p);
  const dRank = rankHand(d);
  
  // Comisión (rake): 5% del pozo, máximo 20 fichas por mano
  if (pRank.type > dRank.type) return 1;  // Jugador gana
  if (pRank.type === dRank.type && pRank.val > dRank.val) return 1;
  return -1; // Banca gana (empate o banca superior)
}

module.exports = {
  create: (uid) => {
    const deck = createDeck();
    const ph = [drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck)];
    const dh = [drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck), drawCard(deck)];
    games.set(uid, { deck, ph, dh, bet: 0, status: 'draw', result: null });
    return games.get(uid);
  },
  get: (uid) => games.get(uid),
  del: (uid) => games.delete(uid),
  drawCards: (uid, indices) => {
    const g = games.get(uid);
    if (!g) return false;
    indices.forEach(i => { if (g.ph[i]) g.ph[i] = drawCard(g.deck); });
    return true;
  },
  compare: (uid) => {
    const g = games.get(uid);
    if (!g) return null;
    const r = compareHands(g.ph, g.dh);
    g.result = r > 0 ? 'win' : 'lose';
    g.status = 'done';
    return g.result;
  },
  formatCard: (c) => `${c.r}${c.s}`,
  formatHand: (h) => h.map(c => `${c.r}${c.s}`).join(' '),
  rankHand
};
