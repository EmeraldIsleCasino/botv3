const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const VALUES = { A: 11, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, J: 10, Q: 10, K: 10 };

const games = new Map();
let deck = [];

function createDeck() {
  const newDeck = [];
  for (let s of SUITS) for (let r of RANKS) newDeck.push({ r, s });
  return newDeck.sort(() => Math.random() - 0.5);
}

function drawCard() {
  if (deck.length < 15) deck = createDeck();
  return deck.pop();
}

function handValue(hand) {
  let v = 0, a = 0;
  for (let c of hand) { v += VALUES[c.r]; if (c.r === 'A') a++; }
  while (v > 21 && a) { v -= 10; a--; }
  return v;
}

function formatCard(c) { return `${c.r}${c.s}`; }
function formatHand(h, hide) { return hide ? `🂠 ${formatCard(h[1])}` : h.map(formatCard).join(' '); }

module.exports = {
  create: (uid) => {
    games.set(uid, { bet: 0, ph: [], dh: [], status: 'bet' });
    return games.get(uid);
  },
  get: (uid) => games.get(uid),
  del: (uid) => games.delete(uid),
  deal: (uid) => {
    const g = games.get(uid);
    if (!g) return false;
    g.ph = [drawCard(), drawCard()];
    g.dh = [drawCard(), drawCard()];
    g.status = 'play';
    return true;
  },
  hit: (uid) => {
    const g = games.get(uid);
    if (!g) return false;
    g.ph.push(drawCard());
    if (handValue(g.ph) > 21) { g.status = 'bust'; g.result = 'lose'; g.payout = 0; }
    return true;
  },
  stand: (uid) => {
    const g = games.get(uid);
    if (!g) return false;
    while (handValue(g.dh) < 17) g.dh.push(drawCard());
    const pv = handValue(g.ph), dv = handValue(g.dh);
    // Probabilidades oficiales: 55% banca, 45% jugador
    const rand = Math.random();
    
    if (handValue(g.dh) > 21) { 
      g.result = 'win'; 
      g.payout = g.bet * 1.5; 
    }
    else if (pv > dv) { 
      // Jugador gana solo si supera la banca Y pasa el 45% de probabilidad
      if (rand < 0.45) { g.result = 'win'; g.payout = g.bet * 1.5; }
      else { g.result = 'lose'; g.payout = 0; }
    }
    else if (pv === dv) {
      // Empate: 50/50 (parte del 55% de banca)
      if (rand < 0.50) { g.result = 'tie'; g.payout = g.bet; }
      else { g.result = 'lose'; g.payout = 0; }
    }
    else { 
      g.result = 'lose'; 
      g.payout = 0; 
    }
    g.status = 'done';
    return true;
  },
  hv: handValue,
  fh: formatHand,
  fc: formatCard
};
