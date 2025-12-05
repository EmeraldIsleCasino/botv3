const minesGame = require('../minigames/mines/handler');
const jackpotGame = require('../minigames/jackpot_rooms/handler');
const duelGame = require('../minigames/arena_duel/handler');
const crashGame = require('../minigames/nahcar_crash/handler');
const boxingGame = require('../minigames/boxing_ls/handler');
const penaltyGame = require('../minigames/penalty_shootout/handler');
const wheelGame = require('../minigames/wheel_xtreme/handler');
const heistGame = require('../minigames/bank_heist/handler');
const duckGame = require('../minigames/duck_race/handler');
const towerGame = require('../minigames/tower/handler');
const nftHandler = require('../nfts/system/handler');

const MINIGAME_PREFIXES = ['mg_', 'mines_', 'jackpot_', 'duel_', 'crash_', 'boxing_', 'penalty_', 'wheel_', 'heist_', 'duck_', 'tower_', 'nft_'];

function isMinigameInteraction(customId) {
  return MINIGAME_PREFIXES.some(prefix => customId.startsWith(prefix));
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) {
      return;
    }

    const customId = interaction.customId;

    if (!isMinigameInteraction(customId)) {
      return;
    }

    console.log(`[Minigames] Handling: ${customId} from ${interaction.user.id}`);

    try {
      if (customId === 'mg_mines' || customId.startsWith('mines_')) {
        await minesGame.handle(interaction);
        return;
      }

      if (customId === 'mg_jackpot' || customId.startsWith('jackpot_')) {
        await jackpotGame.handle(interaction);
        return;
      }

      if (customId === 'mg_duel' || customId.startsWith('duel_')) {
        await duelGame.handle(interaction);
        return;
      }

      if (customId === 'mg_crash' || customId.startsWith('crash_')) {
        await crashGame.handle(interaction);
        return;
      }

      if (customId === 'mg_boxing' || customId.startsWith('boxing_')) {
        await boxingGame.handle(interaction);
        return;
      }

      if (customId === 'mg_penalty' || customId.startsWith('penalty_')) {
        await penaltyGame.handle(interaction);
        return;
      }

      if (customId === 'mg_wheel' || customId.startsWith('wheel_')) {
        await wheelGame.handle(interaction);
        return;
      }

      if (customId === 'mg_heist' || customId.startsWith('heist_')) {
        await heistGame.handle(interaction);
        return;
      }

      if (customId === 'mg_duck' || customId.startsWith('duck_')) {
        await duckGame.handle(interaction);
        return;
      }

      if (customId === 'mg_tower' || customId.startsWith('tower_')) {
        await towerGame.handle(interaction);
        return;
      }

      if (customId.startsWith('nft_')) {
        await nftHandler.handle(interaction);
        return;
      }

    } catch (error) {
      console.error(`[Minigames] Error handling ${customId}:`, error);
      
      const errorReply = {
        content: '❌ Ocurrió un error al procesar tu acción. Inténtalo de nuevo.',
        ephemeral: true
      };

      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      } catch (e) {
        console.error('[Minigames] Error sending error response:', e);
      }
    }
  }
};
