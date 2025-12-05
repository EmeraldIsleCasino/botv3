const RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const games = new Map();

function spin() {
  return Math.floor(Math.random() * 37);
}

function checkWin(result, betType, betAmount) {
  const isRed = RED.includes(result);
  const isEven = result > 0 && result % 2 === 0;
  const isOdd = result > 0 && result % 2 === 1;
  
  let physicalWin = false;
  if (betType === 'r' && isRed) physicalWin = true;
  if (betType === 'b' && !isRed && result > 0) physicalWin = true;
  if (betType === 'e' && isEven) physicalWin = true;
  if (betType === 'o' && isOdd) physicalWin = true;
  
  if (physicalWin && Math.random() < 0.44) {
    return betAmount * 2;
  }
  return 0;
}

module.exports = {
  RED,
  create: (uid, initialBet = 100) => {
    games.set(uid, { bet: initialBet, type: null, status: 'bet', result: null, payout: 0 });
    return games.get(uid);
  },
  get: (uid) => games.get(uid),
  del: (uid) => games.delete(uid),
  setType: (uid, type) => {
    const g = games.get(uid);
    if (g) g.type = type;
    return g;
  },
  setBet: (uid, amount) => {
    const g = games.get(uid);
    if (g) g.bet = amount;
    return g;
  },
  spin: (uid) => {
    const g = games.get(uid);
    if (!g || !g.type || g.bet <= 0) return null;
    
    const result = spin();
    const payout = checkWin(result, g.type, g.bet);
    
    g.result = result;
    g.payout = payout;
    g.status = 'done';
    
    return { result, payout, isRed: RED.includes(result) };
  }
};
