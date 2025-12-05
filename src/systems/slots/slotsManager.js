const GAMES = require("./gamesData");
const economy = require("../../database/economy");
const slots = require("../../database/slots");
const { createEmbed } = require("../../utils/embedBuilder");
const config = require("../../utils/config");
const { getMaxBetLimit, getMinBetLimit } = require("../../utils/memberships");
const { recordWeeklyLoss } = require("../../database/memberships");

class SlotsManager {
  static getGameList() {
    return Object.entries(GAMES).map(([key, game]) => ({
      key,
      ...game,
    }));
  }

  static getGame(gameKey) {
    return GAMES[gameKey];
  }

  static spinReels(gameKey) {
    const game = GAMES[gameKey];
    const reels = [];

    for (let i = 0; i < 3; i++) {
      reels.push(game.symbols[Math.floor(Math.random() * game.symbols.length)]);
    }

    const result = this.evaluateReels(reels, game);

    return {
      reels,
      result: result.type,
      multiplier: result.multiplier,
      isJackpot: result.type === "jackpot",
    };
  }

  static evaluateReels(reels, game) {
    const [r1, r2, r3] = reels;

    // Check for jackpot (3 jackpot symbols)
    if (
      r1 === game.jackpotSymbol &&
      r2 === game.jackpotSymbol &&
      r3 === game.jackpotSymbol
    ) {
      return { type: "jackpot", multiplier: game.multipliers.jackpot };
    }

    // Check for triple match (3 symbols equal)
    if (r1 === r2 && r2 === r3) {
      return { type: "triple", multiplier: game.multipliers.triple };
    }

    // Check for double match (2 symbols equal)
    if (r1 === r2 || r2 === r3 || r1 === r3) {
      return { type: "double", multiplier: game.multipliers.double };
    }

    return { type: "loss", multiplier: 0 };
  }

  static calculatePayout(betAmount, multiplier) {
    if (multiplier === 0) return 0;
    return Math.floor(betAmount * multiplier);
  }

  static async executeSpin(userId, gameKey, betAmount) {
    const game = this.getGame(gameKey);

    // Get bet limits based on membership
    const minBet = getMinBetLimit(userId);
    const maxBet = getMaxBetLimit(userId);

    // Validate bet
    if (betAmount < minBet)
      return {
        error: `❌ Apuesta mínima: ${config.CURRENCY_SYMBOL} ${minBet}`,
      };
    if (betAmount > maxBet)
      return {
        error: `❌ Apuesta máxima: ${config.CURRENCY_SYMBOL} ${maxBet}`,
      };

    const balance = economy.getBalance(userId);
    if (balance < betAmount) {
      return {
        error: `❌ No tienes suficiente saldo. Tienes: ${config.CURRENCY_SYMBOL} ${balance}`,
      };
    }

    // Deduct bet from balance
    economy.deductForBet(userId, betAmount);

    // Spin
    const spin = this.spinReels(gameKey);
    const payout = this.calculatePayout(betAmount, spin.multiplier);

    // Record spin
    slots.recordSpin(
      userId,
      gameKey,
      betAmount,
      JSON.stringify(spin.reels),
      payout,
    );

    // Add payout if won
    if (payout > 0) {
      economy.addWinnings(userId, payout);
    }

    // Registrar pérdida neta para cashback semanal
    const netLoss = betAmount - payout;
    if (netLoss > 0) {
      recordWeeklyLoss(userId, netLoss);
    }

    return {
      success: true,
      game,
      spin,
      payout,
      netWin: payout - betAmount,
    };
  }

  static createSpinEmbed(
    game,
    stage,
    reels = ["❓", "❓", "❓"],
    result = null,
  ) {
    const color = game.colors;

    if (stage === "spinning") {
      return createEmbed({
        title: `${game.name}`,
        description: `\n🎰 **GIRANDO...** 🎰\n\n${reels[0]} ${reels[1]} ${reels[2]}\n\n*Espera los resultados...*`,
        color,
        footer: "Emerald Isle Casino ® - ¡Que la suerte te acompañe!",
      });
    }

    if (stage === "result") {
      let resultText = "";
      let medal = "";

      if (result.type === "jackpot") {
        resultText = `🎉 **¡¡¡JACKPOT!!!** 🎉\n\n🏆 **PREMIO: ${config.CURRENCY_SYMBOL} ${result.payout}**`;
        medal = "✨";
      } else if (result.type === "triple") {
        resultText = `🎊 **¡¡TRIPLE!!! ¡¡GANANCIA!!** 🎊\n\n🏆 **PREMIO: ${config.CURRENCY_SYMBOL} ${result.payout}**`;
        medal = "⭐";
      } else if (result.type === "double") {
        resultText = `✨ **¡DOBLE! ¡Ganancia!** ✨\n\n🏆 **PREMIO: ${config.CURRENCY_SYMBOL} ${result.payout}**`;
        medal = "💫";
      } else {
        resultText = `😢 **Perdiste esta ronda** 😢\n\nIntenta nuevamente...`;
        medal = "❌";
      }

      return createEmbed({
        title: `${medal} ${game.name} ${medal}`,
        description: `\n🎰 **RESULTADO FINAL** 🎰\n\n${reels[0]} ${reels[1]} ${reels[2]}\n\n${resultText}`,
        color,
        footer: "Emerald Isle Casino ® - Presiona GIRAR para otra ronda",
      });
    }
  }
}

module.exports = SlotsManager;
