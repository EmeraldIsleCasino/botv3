const GAMES = {
  volcano: {
    name: '🌋 Volcano Riches',
    symbols: ['🌋', '🔥', '💠', '⭐', '💰', '🌊', '🪨', '🔆'],
    colors: 0xFF4500,
    jackpotSymbol: '🌋',
    probabilities: {
      jackpot: 0.0001,
      triple: 0.008,
      double: 0.035
    },
    multipliers: {
      triple: 3.5,
      double: 1.2,
      jackpot: 15
    }
  },
  dragon: {
    name: '🐉 Dragon\'s Fortune',
    symbols: ['🐉', '🔥', '💠', '🎴', '💰', '🪶', '✨', '🔮'],
    colors: 0xFF1493,
    jackpotSymbol: '🐉',
    probabilities: {
      jackpot: 0.00012,
      triple: 0.009,
      double: 0.04
    },
    multipliers: {
      triple: 4,
      double: 1.3,
      jackpot: 20
    }
  },
  emerald: {
    name: '🍀 Lucky Emerald',
    symbols: ['🍀', '💚', '🪙', '💎', '⭐', '🌿', '🍃', '🟢'],
    colors: 0x00FF7F,
    jackpotSymbol: '🍀',
    probabilities: {
      jackpot: 0.00015,
      triple: 0.01,
      double: 0.045
    },
    multipliers: {
      triple: 2.8,
      double: 1.1,
      jackpot: 12
    }
  },
  royal: {
    name: '👑 Royal Spins',
    symbols: ['👑', '💎', '💰', '🍷', '🎩', '🏆', '⚜️', '👸'],
    colors: 0xFFD700,
    jackpotSymbol: '👑',
    probabilities: {
      jackpot: 0.00008,
      triple: 0.007,
      double: 0.03
    },
    multipliers: {
      triple: 4.5,
      double: 1.4,
      jackpot: 25
    }
  },
  diamond: {
    name: '💎 Diamond Storm',
    symbols: ['💎', '✨', '🔷', '💠', '⭐', '💫', '🔹', '🟦'],
    colors: 0x00BFFF,
    jackpotSymbol: '💎',
    probabilities: {
      jackpot: 0.00011,
      triple: 0.0085,
      double: 0.038
    },
    multipliers: {
      triple: 3.8,
      double: 1.25,
      jackpot: 18
    }
  },
  vegas: {
    name: '🎡 Vegas Rush',
    symbols: ['🎡', '🎰', '🎲', '🃏', '💰', '🎪', '🎭', '🎯'],
    colors: 0xFF69B4,
    jackpotSymbol: '🎰',
    probabilities: {
      jackpot: 0.0001,
      triple: 0.0075,
      double: 0.032
    },
    multipliers: {
      triple: 4.2,
      double: 1.35,
      jackpot: 22
    }
  },
  boom: {
    name: '🧨 Boom Boom Jackpots',
    symbols: ['🧨', '💣', '⚡', '🔗', '💥', '💢', '🔴', '⚠️'],
    colors: 0xFF6347,
    jackpotSymbol: '💥',
    probabilities: {
      jackpot: 0.00014,
      triple: 0.012,
      double: 0.05
    },
    multipliers: {
      triple: 2.5,
      double: 1.0,
      jackpot: 10
    }
  }
};

module.exports = GAMES;
