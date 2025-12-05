const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const giveaways = require("../database/giveaways");
const sports = require("../database/sports");
const insidetrack = require("../database/insidetrack");
const economy = require("../database/economy");
const blackjackDb = require("../database/blackjack");
const SlotsManager = require("../systems/slots/slotsManager");
const bj = require("../systems/blackjack/simple");
const rl = require("../systems/roulette/simple");
const pk = require("../systems/poker/simple");
const { claimDailyReward, getUserDailyStats } = require("../database/dailyRewards");
// Import with fallback for tournament functions
let awardTournamentPoints, joinTournament, leaveTournament, getTournament, getTournamentParticipants, getParticipantCount;

try {
  const tournamentModule = require("../database/tournaments");
  awardTournamentPoints = tournamentModule.awardTournamentPoints;
  joinTournament = tournamentModule.joinTournament;
  leaveTournament = tournamentModule.leaveTournament;
  getTournament = tournamentModule.getTournament;
  getTournamentParticipants = tournamentModule.getTournamentParticipants;
  getParticipantCount = tournamentModule.getParticipantCount;
  console.log('[Init] Tournament functions loaded successfully');
} catch (error) {
  console.warn('[Init] Tournament module not available, using fallback functions');
  // Fallback functions that do nothing but prevent crashes
  awardTournamentPoints = () => {};
  joinTournament = () => ({ success: false, reason: 'module_not_available' });
  leaveTournament = () => false;
  getTournament = () => null;
  getTournamentParticipants = () => [];
  getParticipantCount = () => 0;
}
const { createTournamentEmbed, getGameTypeEmoji, getStatusEmoji, getStatusColor, getTournamentPointsDescription, getRandomMotivationalMessage } = require("../commands/torneos");
const { dashboardHandlers } = require("../commands/dashboard");
const {
  createEmbed,
  errorEmbed,
  successEmbed,
} = require("../utils/embedBuilder");
const config = require("../utils/config");
const { mesas } = require("../commands/blackjackmesa");
const memberships = require("../database/memberships");
const {
  getMembershipType,
  getUserMembership,
  calculateExpirationDate,
  formatMembershipType,
  getMaxBetLimit,
  getMinBetLimit,
  applyBetBonus,
} = require("../utils/memberships");
const { recordWeeklyLoss } = require("../database/memberships");
const {
  assignMembershipRole,
  removeAllMembershipRoles,
} = require("../utils/discordRoles");
const {
  mainEmbed,
  silverEmbed,
  goldEmbed,
  platinumEmbed,
  confirmationEmbed,
  membershipSuccessEmbed,
  alreadyActiveEmbed,
} = require("../utils/membershipEmbeds");

const userSlotsState = new Map();

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        const errorReply = {
          embeds: [errorEmbed("Ocurrió un error al ejecutar este comando.")],
          flags: 64,
        };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorReply);
        } else {
          await interaction.reply(errorReply);
        }
      }
      return;
    }

    if (interaction.isButton()) {
      await handleButton(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModal(interaction);
      return;
    }
  },
};

async function handleButton(interaction) {
  const customId = interaction.customId;
  console.log(`[Button] Recibido: ${customId} de usuario ${interaction.user.id}`);

  if (customId === "giveaway_join") {
    const giveaway = giveaways.getGiveawayByMessage(interaction.message.id);
    if (!giveaway || giveaway.status !== "active") {
      return interaction.reply({
        embeds: [errorEmbed("Este sorteo ya no está activo.")],
        flags: 64,
      });
    }

    if (giveaways.isParticipant(giveaway.id, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed("Ya estás participando en este sorteo.")],
        flags: 64,
      });
    }

    giveaways.addParticipant(giveaway.id, interaction.user.id);
    const count = giveaways.getParticipantCount(giveaway.id);

    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🎉 SORTEO`,
      description: `**¡Participa para ganar!**\n\n🎁 **Premio:** ${giveaway.prize}\n\n👥 **Participantes:** ${count}\n\n*Haz clic en el botón para participar*`,
      footer: "Emerald Isle Casino ® - ¡Buena suerte a todos!",
    });

    await interaction.update({ embeds: [embed] });
    await interaction.followUp({
      embeds: [successEmbed("¡Te has unido al sorteo! Buena suerte.")],
      flags: 64,
    });
    return;
  }

  if (customId.startsWith("sports_bet_")) {
    const parts = customId.split("_");
    const team = parts[2]; // team1, team2, o draw
    const eventId = parseInt(parts[3]);
    const event = sports.getEventById(eventId);

    if (!event || event.status !== "open") {
      return interaction.reply({
        embeds: [errorEmbed("Las apuestas están cerradas.")],
        flags: 64,
      });
    }

    if (sports.getUserBet(event.id, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed("Ya apostaste en este evento.")],
        flags: 64,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`sports_modal_${event.id}_${team}`)
      .setTitle("Realizar Apuesta");

    const amountInput = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel("Cantidad a apostar")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej: 100")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (customId.startsWith("event_select_")) {
    await interaction.deferReply({ flags: 64 });
    const eventId = parseInt(customId.replace("event_select_", ""));
    const event = sports.getEventById(eventId);

    if (!event) {
      return interaction.editReply({
        embeds: [errorEmbed("Evento no encontrado.")],
      });
    }

    if (event.status !== "open") {
      return interaction.editReply({
        embeds: [errorEmbed("Las apuestas están cerradas para este evento.")],
      });
    }

    if (sports.getUserBet(event.id, interaction.user.id)) {
      return interaction.editReply({
        embeds: [errorEmbed("Ya apostaste en este evento.")],
      });
    }

    const SPORTS = {
      futbol: "⚽",
      basket: "🏀",
      beisbol: "⚾",
      nascar: "🏎️",
      boxeo: "🥊",
    };

    const emoji = SPORTS[event.sport] || "🎯";
    let description = `🍀 **${event.title}** 🍀\n\n`;
    description += `${emoji} ${event.sport.toUpperCase()}\n\n`;
    description += `🔵 **${event.team1_name}** | Cuota: \`${event.team1_odds.toFixed(2)}\`\n`;
    description += `🔴 **${event.team2_name}** | Cuota: \`${event.team2_odds.toFixed(2)}\`\n`;
    if (event.draw_odds) {
      description += `⚪ **Empate** | Cuota: \`${event.draw_odds.toFixed(2)}\`\n`;
    }
    description += `\n*Haz clic en tu equipo para apostar*`;

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`sports_bet_team1_${event.id}`)
        .setLabel(`${event.team1_name}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🔵"),
      new ButtonBuilder()
        .setCustomId(`sports_bet_team2_${event.id}`)
        .setLabel(`${event.team2_name}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔴"),
    ];

    if (event.draw_odds) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`sports_bet_draw_${event.id}`)
          .setLabel("Empate")
          .setStyle(ButtonStyle.Secondary)
          .setEmoji("⚪"),
      );
    }

    const row = new ActionRowBuilder().addComponents(buttons);

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: `🍀 ${config.CASINO_NAME} - APUESTA DEPORTIVA 🍀`,
          description,
          color: 0x50c878,
        }),
      ],
      components: [row],
    });
    return;
  }

  if (
    customId.startsWith("sports_bet_team1_") ||
    customId.startsWith("sports_bet_team2_") ||
    customId.startsWith("sports_bet_draw_")
  ) {
    const parts = customId.split("_");
    const eventId = parseInt(parts[parts.length - 1]);
    let team = customId.includes("team1_")
      ? "team1"
      : customId.includes("team2_")
        ? "team2"
        : "draw";

    const event = sports.getEventById(eventId);

    if (!event || event.status !== "open") {
      return interaction.reply({
        embeds: [errorEmbed("Las apuestas están cerradas.")],
        flags: 64,
      });
    }

    if (sports.getUserBet(event.id, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed("Ya apostaste en este evento.")],
        flags: 64,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`sports_modal_${event.id}_${team}`)
      .setTitle("Realizar Apuesta");

    const amountInput = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel("Cantidad a apostar")
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej: 100")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (customId.startsWith("horse_bet_")) {
    const horseIndex = parseInt(customId.replace("horse_bet_", ""));
    const race = insidetrack.getRaceByMessage(interaction.message.id);

    if (!race || race.status !== "betting") {
      return interaction.reply({
        embeds: [errorEmbed("Las apuestas están cerradas.")],
        flags: 64,
      });
    }

    if (insidetrack.getUserBet(race.id, interaction.user.id)) {
      return interaction.reply({
        embeds: [errorEmbed("Ya tienes una apuesta en esta carrera.")],
        flags: 64,
      });
    }

    const horse = race.horses[horseIndex];

    const modal = new ModalBuilder()
      .setCustomId(`horse_modal_${race.id}_${horseIndex}`)
      .setTitle(`Apostar por ${horse.name}`);

    const amountInput = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel(`Cantidad a apostar (Cuota: ${horse.odds.toFixed(2)})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej: 100")
      .setRequired(true);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  // SLOTS BUTTONS
  if (customId.startsWith("slots_game_")) {
    const gameKey = customId.replace("slots_game_", "");
    const game = SlotsManager.getGame(gameKey);

    if (!game) {
      return interaction.reply({
        embeds: [errorEmbed("Juego no encontrado.")],
        flags: 64,
      });
    }

    const balance = economy.getBalance(interaction.user.id);
    const maxBet = getMaxBetLimit(interaction.user.id);

    const embed = createEmbed({
      title: `${game.name}`,
      description: `\n💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance}\n\n🎰 **Apuesta actual:** ${config.CURRENCY_SYMBOL} 100\n💎 **Máximo:** ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}\n\n*Usa los botones para ajustar la apuesta*`,
      color: game.colors,
      footer: "Emerald Isle Casino ® - Presiona GIRAR para jugar",
    });

    userSlotsState.set(interaction.user.id, {
      gameKey,
      betAmount: 100,
    });

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`slots_decrease_${gameKey}`)
        .setLabel("➖ -100")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`slots_spin_${gameKey}`)
        .setLabel("🎰 GIRAR")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`slots_increase_${gameKey}`)
        .setLabel("➕ +100")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("slots_back")
        .setLabel("🔙 Volver")
        .setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);
    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });
    return;
  }

  if (customId.startsWith("slots_increase_")) {
    await interaction.deferUpdate();
    const gameKey = customId.replace("slots_increase_", "");
    const state = userSlotsState.get(interaction.user.id);

    if (!state || state.gameKey !== gameKey) {
      return interaction.followUp({
        embeds: [errorEmbed("Estado no encontrado.")],
        flags: 64,
      });
    }

    const maxBet = getMaxBetLimit(interaction.user.id);
    state.betAmount = Math.min(state.betAmount + 100, maxBet);
    const game = SlotsManager.getGame(gameKey);
    const balance = economy.getBalance(interaction.user.id);

    const embed = createEmbed({
      title: `${game.name}`,
      description: `\n💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance}\n\n🎰 **Apuesta actual:** ${config.CURRENCY_SYMBOL} ${state.betAmount}\n💎 **Máximo:** ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}\n\n*Usa los botones para ajustar la apuesta*`,
      color: game.colors,
      footer: "Emerald Isle Casino ® - Presiona GIRAR para jugar",
    });

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`slots_decrease_${gameKey}`)
        .setLabel("➖ -100")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`slots_spin_${gameKey}`)
        .setLabel("🎰 GIRAR")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`slots_increase_${gameKey}`)
        .setLabel("➕ +100")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("slots_back")
        .setLabel("🔙 Volver")
        .setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);
    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  if (customId.startsWith("slots_decrease_")) {
    await interaction.deferUpdate();
    const gameKey = customId.replace("slots_decrease_", "");
    const state = userSlotsState.get(interaction.user.id);

    if (!state || state.gameKey !== gameKey) {
      return interaction.followUp({
        embeds: [errorEmbed("Estado no encontrado.")],
        flags: 64,
      });
    }

    const minBet = getMinBetLimit(interaction.user.id);
    const maxBet = getMaxBetLimit(interaction.user.id);
    state.betAmount = Math.max(state.betAmount - 100, minBet);
    const game = SlotsManager.getGame(gameKey);
    const balance = economy.getBalance(interaction.user.id);

    const embed = createEmbed({
      title: `${game.name}`,
      description: `\n💰 **Tu saldo:** ${config.CURRENCY_SYMBOL} ${balance}\n\n🎰 **Apuesta actual:** ${config.CURRENCY_SYMBOL} ${state.betAmount}\n💎 **Máximo:** ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}\n\n*Usa los botones para ajustar la apuesta*`,
      color: game.colors,
      footer: "Emerald Isle Casino ® - Presiona GIRAR para jugar",
    });

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`slots_decrease_${gameKey}`)
        .setLabel("➖ -100")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`slots_spin_${gameKey}`)
        .setLabel("🎰 GIRAR")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`slots_increase_${gameKey}`)
        .setLabel("➕ +100")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("slots_back")
        .setLabel("🔙 Volver")
        .setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder().addComponents(buttons);
    await interaction.editReply({ embeds: [embed], components: [row] });
    return;
  }

  if (customId.startsWith("slots_spin_")) {
    await interaction.deferUpdate();
    const gameKey = customId.replace("slots_spin_", "");
    const state = userSlotsState.get(interaction.user.id);

    if (!state || state.gameKey !== gameKey) {
      return interaction.followUp({
        embeds: [errorEmbed("Estado no encontrado.")],
        flags: 64,
      });
    }

    const game = SlotsManager.getGame(gameKey);

    // Show spinning animation
    const spinningEmbed = SlotsManager.createSpinEmbed(game, "spinning");
    await interaction.editReply({ embeds: [spinningEmbed], components: [] });

    // Simulate spinning animation
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Execute spin
    const result = await SlotsManager.executeSpin(
      interaction.user.id,
      gameKey,
      state.betAmount,
    );

    if (result.error) {
      const errorEmbed = createEmbed({
        description: result.error,
        color: 0xff6b6b,
      });
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Animate reels reveal
    const reels = result.spin.reels;
    let displayReels = ["❓", "❓", "❓"];

    // First reel
    await new Promise((resolve) => setTimeout(resolve, 250));
    displayReels[0] = reels[0];
    let animEmbed = SlotsManager.createSpinEmbed(
      game,
      "spinning",
      displayReels,
    );
    await interaction.editReply({ embeds: [animEmbed] });

    // Second reel
    await new Promise((resolve) => setTimeout(resolve, 250));
    displayReels[1] = reels[1];
    animEmbed = SlotsManager.createSpinEmbed(game, "spinning", displayReels);
    await interaction.editReply({ embeds: [animEmbed] });

    // Third reel
    await new Promise((resolve) => setTimeout(resolve, 250));
    displayReels[2] = reels[2];
    animEmbed = SlotsManager.createSpinEmbed(game, "spinning", displayReels);
    await interaction.editReply({ embeds: [animEmbed] });

    // Final result
    await new Promise((resolve) => setTimeout(resolve, 300));
    const resultEmbed = SlotsManager.createSpinEmbed(game, "result", reels, {
      type: result.spin.result,
      payout: result.payout,
    });

    const playAgainButtons = [
      new ButtonBuilder()
        .setCustomId(`slots_spin_${gameKey}`)
        .setLabel("🎰 GIRAR DE NUEVO")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("slots_back")
        .setLabel("🔙 Volver al Menú")
        .setStyle(ButtonStyle.Secondary),
    ];

    const row = new ActionRowBuilder().addComponents(playAgainButtons);
    await interaction.editReply({ embeds: [resultEmbed], components: [row] });
    return;
  }

  if (customId === "slots_back") {
    await interaction.deferUpdate();
    userSlotsState.delete(interaction.user.id);
    const games = SlotsManager.getGameList();

    const description = games
      .map((game, idx) => `**${idx + 1}.** ${game.name}`)
      .join("\n");

    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🎰 SLOTS`,
      description: `\n📌 **Elige un juego:**\n\n${description}\n\n💎 Mínimo: $100 | Máximo: $${getMaxBetLimit(interaction.user.id).toLocaleString()}`,
      color: 0x00ff7f,
      footer: "Emerald Isle Casino ® - ¡Buena suerte!",
    });

    const buttons = games.map((game, idx) =>
      new ButtonBuilder()
        .setCustomId(`slots_game_${game.key}`)
        .setLabel(game.name.split(" ")[1])
        .setStyle(ButtonStyle.Primary)
        .setEmoji(game.name.split(" ")[0]),
    );

    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
      rows.push(row);
    }

    await interaction.editReply({ embeds: [embed], components: rows });
    return;
  }

  // BLACKJACK MESA - Botón para jugar
  if (customId === "bj_play") {
    await interaction.deferReply({ flags: 64 });
    const uid = interaction.user.id;
    bj.create(uid);
    const g = bj.get(uid);
    const bal = economy.getBalance(uid);

    const desc = `🍀 **Jugador:** <@${uid}>\n💰 **Saldo:** $${bal.toLocaleString()}\n**Apuesta:** $${g.bet.toLocaleString()}\n\n*Ajusta tu apuesta y haz clic en REPARTIR*`;
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
      description: desc,
      color: 0x50c878,
    });

    const btns = [
      new ButtonBuilder()
        .setCustomId(`bj_down_${uid}`)
        .setLabel("➖")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`bj_deal_${uid}`)
        .setLabel("🎰 REPARTIR")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bj_up_${uid}`)
        .setLabel("➕")
        .setStyle(ButtonStyle.Primary),
    ];

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(btns)],
    });
  }

  // BLACKJACK MODAL
  if (customId.startsWith("bj_modal_")) {
    const uid = customId.replace("bj_modal_", "");
    const bal = economy.getBalance(uid) || 0;
    const maxBet = getMaxBetLimit(uid);

    const modal = new ModalBuilder()
      .setCustomId(`bj_bet_modal_${uid}`)
      .setTitle('🎰 Configurar Apuesta - Blackjack');

    const amountInput = new TextInputBuilder()
      .setCustomId("bet_amount")
      .setLabel(`Cantidad a apostar (Máx: ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder("Ej: 100")
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);

    const row = new ActionRowBuilder().addComponents(amountInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  // BLACKJACK BOTONES - Apuestas y juego
  if (
    customId?.startsWith("bj_up_") ||
    customId?.startsWith("bj_down_") ||
    customId?.startsWith("bj_deal_") ||
    customId?.startsWith("bj_hit_") ||
    customId?.startsWith("bj_stand_") ||
    customId?.startsWith("bj_again_")
  ) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const g = bj.get(uid);
    if (!g)
      return interaction.followUp({
        embeds: [errorEmbed("Sin partida.")],
        flags: 64,
      });

    const bal = economy.getBalance(uid);

    const maxBet = getMaxBetLimit(uid);
    const minBet = getMinBetLimit(uid);
    if (customId.startsWith("bj_up_")) g.bet = Math.min(g.bet + 100, maxBet);
    if (customId.startsWith("bj_down_")) g.bet = Math.max(g.bet - 100, minBet);
    if (customId.startsWith("bj_deal_")) {
      if (g.bet === 0 || bal < g.bet)
        return interaction.followUp({
          embeds: [errorEmbed("Apuesta inválida")],
          flags: 64,
        });
      economy.deductForBet(uid, g.bet);
      bj.deal(uid);
    }
    if (customId.startsWith("bj_hit_")) {
      bj.hit(uid);
      if (g.status === "bust") {
        blackjackDb.recordGame(uid, g.bet, "lose", 0);
        // Registrar pérdida neta para cashback semanal
        recordWeeklyLoss(uid, g.bet);
        const embed = createEmbed({
          title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
          description: `🍀 <@${uid}>\n**TU MANO:** ${bj.fh(g.ph)} (${bj.hv(g.ph)})\n❌ **¡BUST! La banca prevaleció.**\n💎 Apuesta Perdida: -$${g.bet.toLocaleString()}\n\n*Mejor suerte en la próxima mano, jugador de élite.*`,
          color: 0xff6b6b,
        });
        const btns = [
          new ButtonBuilder()
            .setCustomId(`bj_again_${uid}`)
            .setLabel("🎰 OTRA")
            .setStyle(ButtonStyle.Success),
        ];
        await interaction.editReply({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(btns)],
        });
        return;
      }
    }
    if (customId.startsWith("bj_stand_")) {
      bj.stand(uid);
      // Aplicar bono de ganancias de membresía antes de registrar
      let finalPayout = g.payout;
      if (g.payout > 0) {
        finalPayout = applyBetBonus(uid, g.payout);
      }
      blackjackDb.recordGame(uid, g.bet, g.result, finalPayout);
      if (finalPayout > 0) {
        economy.addWinnings(uid, finalPayout);
        // Otorgar puntos de torneo por victoria
        try {
          if (typeof awardTournamentPoints === 'function') {
            awardTournamentPoints(uid, 'blackjack', 10, 'victoria en blackjack');
          } else {
            console.warn('[Blackjack] awardTournamentPoints not available - tournament points not awarded');
          }
        } catch (error) {
          console.warn('[Blackjack] Error awarding tournament points:', error);
        }
      }
      // Registrar pérdida neta para cashback semanal
      const netLoss = g.bet - finalPayout;
      if (netLoss > 0) {
        recordWeeklyLoss(uid, netLoss);
      }
      const res =
        g.result === "win"
          ? "🏆 ¡VICTORIA GLORIOSA!"
          : g.result === "tie"
            ? "⚖️ Empate Honorable"
            : "⚔️ La Banca Prevaleció";
      const embed = createEmbed({
        title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
        description: `🍀 <@${uid}>\n\n**TU MANO (ÉLITE):** ${bj.fh(g.ph)} (${bj.hv(g.ph)})\n**BANCA:** ${bj.fh(g.dh)} (${bj.hv(g.dh)})\n\n${res}\n💰 **Resultado:** ${finalPayout > 0 ? `+$${finalPayout.toLocaleString()}` : `-$${g.bet.toLocaleString()}`}\n${finalPayout !== g.payout ? `💎 **Bono Membresía:** +$${(finalPayout - g.payout).toLocaleString()}` : ''}\n\n*${g.result === "win" ? "Tu maestría fue evidente. La élite reconoce la élite." : "El destino ha hablado. Regresa a conquistar la gloria."}*`,
        color: g.result === "win" ? 0x00ff00 : 0xff6b6b,
      });
      const btns = [
        new ButtonBuilder()
          .setCustomId(`bj_again_${uid}`)
          .setLabel("🎰 OTRA")
          .setStyle(ButtonStyle.Success),
      ];
      await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(btns)],
      });
      return;
    }
    if (customId.startsWith("bj_again_")) {
      bj.del(uid);
      bj.create(uid);
      const g2 = bj.get(uid);
      const bal2 = economy.getBalance(uid);
      const embed = createEmbed({
        title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
        description: `👑 **JUGADOR VIP:** <@${uid}>\n💰 **Saldo:** $${bal2.toLocaleString()}\n💎 **Apuesta Siguiente:** $${g2.bet.toLocaleString()}\n\n✨ *Regresa a conquistar gloria. Ajusta tu apuesta y REPARTIR*\n🏆 **La élite nunca se rinde** 🏆`,
        color: 0x50c878,
      });
      const btns = [
        new ButtonBuilder()
          .setCustomId(`bj_down_${uid}`)
          .setLabel("➖ Menos")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`bj_deal_${uid}`)
          .setLabel("🎰 REPARTIR")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`bj_up_${uid}`)
          .setLabel("➕ Más")
          .setStyle(ButtonStyle.Primary),
      ];
      await interaction.editReply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(btns)],
      });
      return;
    }

    let desc, btns;
    if (g.status === "bet") {
      desc = `👑 **JUGADOR VIP:** <@${uid}>\n💰 **Saldo:** $${bal.toLocaleString()}\n💎 **Apuesta:** $${g.bet.toLocaleString()}\n\n✨ *Ajusta tu apuesta de lujo y haz clic en REPARTIR* ✨`;
      btns = [
        new ButtonBuilder()
          .setCustomId(`bj_down_${uid}`)
          .setLabel("➖ Menos")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`bj_deal_${uid}`)
          .setLabel("🎰 REPARTIR")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`bj_up_${uid}`)
          .setLabel("➕ Más")
          .setStyle(ButtonStyle.Primary),
      ];
    } else {
      desc = `🍀 <@${uid}>\n**TU MANO (ÉLITE):** ${bj.fh(g.ph)} (${bj.hv(g.ph)})\n**BANCA:** ${bj.fh(g.dh, true)}\n💎 **Apuesta Premium:** $${g.bet.toLocaleString()}\n\n*Demuestra tu maestría*`;
      btns = [
        new ButtonBuilder()
          .setCustomId(`bj_hit_${uid}`)
          .setLabel("🎯 Pedir")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`bj_stand_${uid}`)
          .setLabel("👑 Quedarse")
          .setStyle(ButtonStyle.Success),
      ];
    }

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
      description: desc,
      color: 0x50c878,
    });

    await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(btns)],
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // RULETA - Sistema limpio basado en blackjack
  // ═══════════════════════════════════════════════════════════════
  if (customId === "rl_play") {
    await interaction.deferReply({ flags: 64 });
    const uid = interaction.user.id;
    const minBet = getMinBetLimit(uid);
    rl.del(uid);
    rl.create(uid, minBet);
    const g = rl.get(uid);
    const bal = economy.getBalance(uid) || 0;

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🎡 RULETA 🍀`,
      description: `👑 **Jugador:** <@${uid}>\n💰 **Saldo:** $${bal.toLocaleString()}\n💎 **Apuesta:** $${g.bet.toLocaleString()}\n\n🔴 ROJO | ⚫ NEGRO | 🔷 PAR | 🔶 IMPAR\n\n*Selecciona tipo y ajusta tu apuesta*`,
      color: 0xe91e63,
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rl_r_${uid}`).setLabel("🔴 ROJO").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`rl_b_${uid}`).setLabel("⚫ NEGRO").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rl_e_${uid}`).setLabel("🔷 PAR").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rl_o_${uid}`).setLabel("🔶 IMPAR").setStyle(ButtonStyle.Primary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rl_down_${uid}`).setLabel("➖").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`rl_spin_${uid}`).setLabel("🎡 GIRAR").setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId(`rl_up_${uid}`).setLabel("➕").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rl_exit_${uid}`).setLabel("❌").setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  }

  // RULETA - Todos los botones
  if (
    customId?.startsWith("rl_r_") ||
    customId?.startsWith("rl_b_") ||
    customId?.startsWith("rl_e_") ||
    customId?.startsWith("rl_o_") ||
    customId?.startsWith("rl_up_") ||
    customId?.startsWith("rl_down_") ||
    customId?.startsWith("rl_spin_") ||
    customId?.startsWith("rl_again_") ||
    customId?.startsWith("rl_exit_")
  ) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const maxBet = getMaxBetLimit(uid);
    const minBet = getMinBetLimit(uid);
    let g = rl.get(uid);
    if (!g) {
      rl.create(uid, minBet);
      g = rl.get(uid);
    }

    const bal = economy.getBalance(uid) || 0;
    const typeLabels = { r: "🔴 ROJO", b: "⚫ NEGRO", e: "🔷 PAR", o: "🔶 IMPAR" };

    if (customId.startsWith("rl_r_")) rl.setType(uid, "r");
    if (customId.startsWith("rl_b_")) rl.setType(uid, "b");
    if (customId.startsWith("rl_e_")) rl.setType(uid, "e");
    if (customId.startsWith("rl_o_")) rl.setType(uid, "o");
    if (customId.startsWith("rl_up_")) g.bet = Math.min(g.bet + 100, maxBet, bal);
    if (customId.startsWith("rl_down_")) g.bet = Math.max(g.bet - 100, minBet);

    if (customId.startsWith("rl_exit_")) {
      rl.del(uid);
      const exitEmbed = createEmbed({
        title: `${config.CASINO_NAME} - 🎡 RULETA`,
        description: `✅ **Sesión terminada**\n\nGracias por jugar en ${config.CASINO_NAME}!`,
        color: 0x00ff00,
      });
      await interaction.editReply({ embeds: [exitEmbed], components: [] });
      return;
    }

    if (customId.startsWith("rl_again_")) {
      rl.del(uid);
      rl.create(uid, minBet);
      g = rl.get(uid);
    }

    if (customId.startsWith("rl_spin_")) {
      if (!g.type || g.bet <= 0 || bal < g.bet) {
        return interaction.followUp({ embeds: [errorEmbed("Selecciona tipo y apuesta válida.")], flags: 64 });
      }
      if (g.bet < minBet) {
        return interaction.followUp({ embeds: [errorEmbed(`Apuesta mínima: $${minBet}`)], flags: 64 });
      }

      economy.deductForBet(uid, g.bet);

      const spinEmbed = createEmbed({
        title: `${config.CASINO_NAME} - 🎡 RULETA`,
        description: `👤 <@${uid}>\n💎 **Apuesta:** $${g.bet.toLocaleString()} en ${typeLabels[g.type]}\n\n🎡 🎡 🎡 **GIRANDO...** 🎡 🎡 🎡`,
        color: 0xe91e63,
      });
      await interaction.editReply({ embeds: [spinEmbed], components: [] });
      await new Promise(r => setTimeout(r, 2000));

      const spinResult = rl.spin(uid);
      if (!spinResult) {
        economy.addWinnings(uid, g.bet);
        return interaction.editReply({ embeds: [errorEmbed("Error en el giro. Apuesta devuelta.")], components: [] });
      }

      const { result, payout, isRed } = spinResult;
      let finalPayout = payout;
      if (payout > 0) {
        finalPayout = applyBetBonus(uid, payout);
        economy.addWinnings(uid, finalPayout);
        try { awardTournamentPoints?.(uid, 'roulette', 5, 'victoria en ruleta'); } catch {}
      } else {
        recordWeeklyLoss(uid, g.bet);
      }

      const resultEmbed = createEmbed({
        title: `${config.CASINO_NAME} - 🎡 RULETA`,
        description: `👤 <@${uid}>\n\n┌──────────────────┐\n│ 🎡 **${result}** 🎡 │\n│ ${isRed ? "🔴 ROJO" : "⚫ NEGRO"} - ${result % 2 === 0 ? "🔷 PAR" : "🔶 IMPAR"} │\n└──────────────────┘\n\n**Tu apuesta:** ${typeLabels[g.type]} - $${g.bet.toLocaleString()}\n\n${finalPayout > 0 ? `🎉 **¡GANASTE!**\n💰 **+$${finalPayout.toLocaleString()}**` : `❌ **Perdiste**\n💎 **-$${g.bet.toLocaleString()}**`}`,
        color: finalPayout > 0 ? 0x00ff00 : 0xff6b6b,
      });

      const againRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`rl_again_${uid}`).setLabel("🎡 OTRA VEZ").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`rl_exit_${uid}`).setLabel("❌ Salir").setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [resultEmbed], components: [againRow] });
      return;
    }

    const canSpin = g.type && g.bet >= minBet && g.bet <= bal;
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🎡 RULETA 🍀`,
      description: `👑 **Jugador:** <@${uid}>\n💰 **Saldo:** $${bal.toLocaleString()}\n💎 **Apuesta:** $${g.bet.toLocaleString()}${g.type ? ` en ${typeLabels[g.type]}` : ""}\n\n🔴 ROJO | ⚫ NEGRO | 🔷 PAR | 🔶 IMPAR\n\n*${!g.type ? "Selecciona un tipo" : "Listo para girar"}*`,
      color: 0xe91e63,
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rl_r_${uid}`).setLabel("🔴 ROJO").setStyle(g.type === "r" ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`rl_b_${uid}`).setLabel("⚫ NEGRO").setStyle(g.type === "b" ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`rl_e_${uid}`).setLabel("🔷 PAR").setStyle(g.type === "e" ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rl_o_${uid}`).setLabel("🔶 IMPAR").setStyle(g.type === "o" ? ButtonStyle.Success : ButtonStyle.Primary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rl_down_${uid}`).setLabel("➖").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`rl_spin_${uid}`).setLabel("🎡 GIRAR").setStyle(ButtonStyle.Success).setDisabled(!canSpin),
      new ButtonBuilder().setCustomId(`rl_up_${uid}`).setLabel("➕").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rl_exit_${uid}`).setLabel("❌").setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  }
  // ═══════════════════════════════════════════════════════════════

  // POKER MESA - Jugar
  if (customId === "pk_play") {
    await interaction.deferReply({ flags: 64 });
    const uid = interaction.user.id;
    pk.create(uid);
    const bal = economy.getBalance(uid);

    const maxBet = getMaxBetLimit(uid);
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 TEXAS HOLD'EM 🍀`,
      description: `👑 **JUGADOR DE ÉLITE:** <@${uid}>\n💰 **Patrimonio Premium:** $${bal.toLocaleString()}\n\n✨ 🃏 🃏 🃏 🃏 🃏 ✨\n\n**╔═══ APUESTAS EXCLUSIVAS ═══╗**\n**║ Mínimo: $100             ║**\n**║ Máximo: $${maxBet.toLocaleString()}           ║**\n**╚════════════════════════════╝**\n\n🏆 *Solo ganas si tu mano SUPERA la banca*\n💎 *Payout Premium: 2:1 en victorias*\n⭐ *Comparación justa - Sin trucos*`,
      color: 0x50c878,
    });

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`pk_bet_100_${uid}`)
        .setLabel("💵 $100")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_bet_500_${uid}`)
        .setLabel("💵 $500")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pk_bet_1k_${uid}`)
        .setLabel("💰 $1000")
        .setStyle(ButtonStyle.Primary),
    ];

    if (maxBet >= 5000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_5k_${uid}`)
          .setLabel("🏆 $5000")
          .setStyle(ButtonStyle.Danger),
      );
    }
    if (maxBet >= 7500) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_7k5_${uid}`)
          .setLabel("💎 $7500")
          .setStyle(ButtonStyle.Danger),
      );
    }
    if (maxBet >= 10000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_10k_${uid}`)
          .setLabel("👑 $10000")
          .setStyle(ButtonStyle.Success),
      );
    }
    if (maxBet >= 15000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_15k_${uid}`)
          .setLabel("💎 $15000")
          .setStyle(ButtonStyle.Success),
      );
    }

    const btns = new ActionRowBuilder().addComponents(buttons);

    await interaction.editReply({ embeds: [embed], components: [btns] });
  }

  // POKER - Repartir mano
  if (customId?.startsWith("pk_bet_")) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const g = pk.get(uid);
    if (!g)
      return interaction.followUp({
        embeds: [errorEmbed("Error.")],
        flags: 64,
      });

    const maxBet = getMaxBetLimit(uid);
    const bets = {
      [`pk_bet_100_${uid}`]: 100,
      [`pk_bet_500_${uid}`]: 500,
      [`pk_bet_1k_${uid}`]: 1000,
      [`pk_bet_5k_${uid}`]: 5000,
      [`pk_bet_7k5_${uid}`]: 7500,
      [`pk_bet_10k_${uid}`]: 10000,
      [`pk_bet_15k_${uid}`]: 15000,
      pk_bet_100: 100,
      pk_bet_500: 500,
      pk_bet_1k: 1000,
      pk_bet_5k: 5000,
    };
    const bet = bets[customId];
    const bal = economy.getBalance(uid);

    if (!bet || bet > maxBet)
      return interaction.followUp({
        embeds: [
          errorEmbed(
            `Apuesta inválida. Máximo permitido: ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}`,
          ),
        ],
        flags: 64,
      });
    if (bal < bet)
      return interaction.followUp({
        embeds: [errorEmbed("Saldo insuficiente")],
        flags: 64,
      });

    economy.deductForBet(uid, bet);
    g.bet = bet;
    // Aplicar comisión (rake): 5% máximo 20 fichas
    const rake = Math.min(Math.floor(bet * 0.05), 20);
    g.rake = rake;

    const cardsStr = g.ph
      .map((c, i) => `**${i + 1}:** ${c.r}${c.s}`)
      .join(" | ");
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 TEXAS HOLD'EM 🍀`,
      description: `🍀 <@${uid}> | 💎 **Apuesta Premium:** $${bet.toLocaleString()} | 🏦 **Rake:** $${g.rake}\n\n🍀 POKER 🍀\n**TUS CARTAS DE ÉLITE**\n${pk.formatHand(g.ph)}\n🍀 POKER 🍀\n\n**╔════ ESTRATEGIA ════╗**\n**║ Selecciona cartas para cambiar**\n**╚═══════════════════╝**\n\n🎯 *Haz clic en números para cambiar*\n🏆 *O presiona JUGAR sin cambiar*`,
      color: 0x50c878,
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_toggle_0_${uid}`)
        .setLabel("1️⃣")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_1_${uid}`)
        .setLabel("2️⃣")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_2_${uid}`)
        .setLabel("3️⃣")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_3_${uid}`)
        .setLabel("4️⃣")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_4_${uid}`)
        .setLabel("5️⃣")
        .setStyle(ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_draw_${uid}`)
        .setLabel("🔄 CAMBIAR")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pk_stand_${uid}`)
        .setLabel("🎯 JUGAR")
        .setStyle(ButtonStyle.Success),
    );

    g.selected = [false, false, false, false, false];
    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  }

  // POKER - Toggle cartas
  if (customId?.startsWith("pk_toggle_")) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const g = pk.get(uid);
    if (!g) return;

    const parts = customId.split("_");
    const idx = parseInt(parts[2]);
    g.selected[idx] = !g.selected[idx];

    const count = g.selected.filter((s) => s).length;
    const selStr = g.selected
      .map((s, i) =>
        s ? `**${g.ph[i].r}${g.ph[i].s}** ✓` : `${g.ph[i].r}${g.ph[i].s}`,
      )
      .join(" | ");
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 TEXAS HOLD'EM 🍀`,
      description: `🍀 <@${uid}> | 💎 **Apuesta Premium:** $${g.bet.toLocaleString()} | 🏦 **Rake:** $${g.rake}\n\n🍀 POKER 🍀\n**TUS CARTAS SELECCIONADAS**\n${selStr}\n🍀 POKER 🍀\n\n**╔════ CAMBIOS MARCADOS ════╗**\n**║ ${count} carta${count !== 1 ? "s" : ""} para cambiar**\n**╚════════════════════════╝**\n\n🎯 *Haz clic para deseleccionar* `,
      color: 0x50c878,
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_toggle_0_${uid}`)
        .setLabel("1️⃣")
        .setStyle(g.selected[0] ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_1_${uid}`)
        .setLabel("2️⃣")
        .setStyle(g.selected[1] ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_2_${uid}`)
        .setLabel("3️⃣")
        .setStyle(g.selected[2] ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_3_${uid}`)
        .setLabel("4️⃣")
        .setStyle(g.selected[3] ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_toggle_4_${uid}`)
        .setLabel("5️⃣")
        .setStyle(g.selected[4] ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_draw_${uid}`)
        .setLabel("🔄 CAMBIAR")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pk_stand_${uid}`)
        .setLabel("🎯 JUGAR")
        .setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
  }

  // POKER - Cambiar cartas
  if (customId?.startsWith("pk_draw_")) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const g = pk.get(uid);
    if (!g) return;

    const indices = g.selected
      .map((s, i) => (s ? i : -1))
      .filter((i) => i >= 0);
    pk.drawCards(uid, indices);

    g.selected = [false, false, false, false, false];

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 TEXAS HOLD'EM 🍀`,
      description: `🍀 <@${uid}> | 💎 **Apuesta Premium:** $${g.bet.toLocaleString()} | 🏦 **Rake:** $${g.rake}\n\n🍀 POKER 🍀\n**TUS CARTAS NUEVAS (ELEGIDAS)**\n${pk.formatHand(g.ph)}\n🍀 POKER 🍀\n\n🏆 **¡El momento de la verdad ha llegado!**\n🎯 *Haz clic JUGAR para enfrentar a la Banca*`,
      color: 0x50c878,
    });

    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_stand_${uid}`)
        .setLabel("🎯 JUGAR")
        .setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({ embeds: [embed], components: [btns] });
  }

  // POKER - Comparar manos
  if (customId?.startsWith("pk_stand_")) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;
    const g = pk.get(uid);
    if (!g) return;

    const result = pk.compare(uid);
    const win = result === "win" ? g.bet * 2 : 0;
    const titles = {
      0: "High Card",
      1: "One Pair",
      2: "Two Pair",
      3: "Three of a Kind",
      4: "Straight",
      5: "Flush",
      6: "Full House",
      7: "Four of a Kind",
      8: "Straight Flush",
    };
    const pRank = titles[pk.rankHand(g.ph).type];
    const dRank = titles[pk.rankHand(g.dh).type];
    const emojis = {
      0: "🎫",
      1: "👥",
      2: "👥👥",
      3: "🎯🎯🎯",
      4: "➡️",
      5: "🌈",
      6: "🏠",
      7: "💣💣💣💣",
      8: "🌈➡️",
    };

    if (win > 0) {
      economy.addWinnings(uid, win);
      // Otorgar puntos de torneo por victoria
      try {
        if (typeof awardTournamentPoints === 'function') {
          awardTournamentPoints(uid, 'roulette', 5, 'victoria en ruleta');
        } else {
          console.warn('[Roulette] awardTournamentPoints not available - tournament points not awarded');
        }
      } catch (error) {
        console.warn('[Roulette] Error awarding tournament points:', error);
      }
    }
    // Registrar pérdida neta para cashback semanal
    if (win === 0) {
      recordWeeklyLoss(uid, bet);
    }

    const resEmbed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 SHOWDOWN FINAL 🍀`,
      description: `╔═════════════════════════════╗\n║ 🃏 **RESULTADO DEFINITIVO** 🃏 ║\n╚═════════════════════════════╝\n\n👑 **TU MANO DE ÉLITE**\n${pk.formatHand(g.ph)}\n${emojis[pk.rankHand(g.ph).type]} ${pRank}\n\n⚔️ ━━━━ ENFRENTAMIENTO ━━━━ ⚔️\n\n🏦 **BANCA**\n${pk.formatHand(g.dh)}\n${emojis[pk.rankHand(g.dh).type]} ${dRank}\n\n${"═".repeat(30)}\n\n${result === "win" ? `🏆 **¡VICTORIA ÉPICA!** 🏆\n💰 **Ganancias:** +$${win.toLocaleString()}\n\n**La élite ha prevalecido. Tu maestría es incontestable.**` : `⚔️ **LA BANCA PREVALECIÓ** ⚔️\n💎 **Pérdida:** -$${g.bet.toLocaleString()}\n\n*El destino ha hablado. Los campeones no se rinden.*`}`,
      color: result === "win" ? 0x00ff00 : 0xff6b6b,
    });

    const btns = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pk_again_${uid}`)
        .setLabel("🃏 OTRA MANO")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pk_exit_${uid}`)
        .setLabel("❌ Salir")
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [resEmbed], components: [btns] });
  }

  // POKER - Otra o salir
  if (customId?.startsWith("pk_again_") || customId?.startsWith("pk_exit_")) {
    await interaction.deferUpdate();
    const uid = interaction.user.id;

    if (customId.startsWith("pk_exit_")) {
      pk.del(uid);
      await interaction.editReply({ components: [] });
      return;
    }

    pk.del(uid);
    pk.create(uid);
    const bal = economy.getBalance(uid);

    const maxBet = getMaxBetLimit(uid);
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🃏 TEXAS HOLD'EM POKER`,
      description: `👤 **Jugador:** <@${uid}>\n💰 **Saldo:** $${bal}\n\n🃏 🃏 🃏 🃏 🃏\n\n**┌─── APUESTAS ───┐**\n**│ Mín: $100    │**\n**│ Máx: $${maxBet.toLocaleString()}   │**\n**└────────────────┘**\n\n💡 *Solo ganas si tu mano es MEJOR que la banca*\n💡 *Rake (comisión): 5% máximo 20 fichas*`,
      color: 0x50c878,
    });

    const buttons = [
      new ButtonBuilder()
        .setCustomId(`pk_bet_100_${uid}`)
        .setLabel("💵 $100")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pk_bet_500_${uid}`)
        .setLabel("💵 $500")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pk_bet_1k_${uid}`)
        .setLabel("💰 $1000")
        .setStyle(ButtonStyle.Primary),
    ];

    if (maxBet >= 5000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_5k_${uid}`)
          .setLabel("🏆 $5000")
          .setStyle(ButtonStyle.Danger),
      );
    }
    if (maxBet >= 7500) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_7k5_${uid}`)
          .setLabel("💎 $7500")
          .setStyle(ButtonStyle.Danger),
      );
    }
    if (maxBet >= 10000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_10k_${uid}`)
          .setLabel("👑 $10000")
          .setStyle(ButtonStyle.Success),
      );
    }
    if (maxBet >= 15000) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`pk_bet_15k_${uid}`)
          .setLabel("💎 $15000")
          .setStyle(ButtonStyle.Success),
      );
    }

    const btns = new ActionRowBuilder().addComponents(buttons);

    await interaction.editReply({ embeds: [embed], components: [btns] });
  }

  // DASHBOARD BUTTONS
  if (customId.startsWith("dashboard_")) {
    await interaction.deferReply({ flags: 64 });

    try {
      const { collectDashboardData, createMainDashboardEmbed } = require("../commands/dashboard");
      const dashboardData = await collectDashboardData();

      let embed;
      let buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('dashboard_main')
          .setLabel('🏠 Principal')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('dashboard_users')
          .setLabel('👥 Usuarios')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('dashboard_economy')
          .setLabel('💰 Economía')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('dashboard_systems')
          .setLabel('🎰 Sistemas')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('dashboard_activity')
          .setLabel('📊 Actividad')
          .setStyle(ButtonStyle.Primary)
      );

      switch (customId) {
        case 'dashboard_main':
        case 'dashboard_refresh':
          embed = createMainDashboardEmbed(dashboardData);
          break;
        case 'dashboard_users':
          embed = dashboardHandlers.createUsersEmbed(dashboardData);
          break;
        case 'dashboard_economy':
          embed = dashboardHandlers.createEconomyEmbed(dashboardData);
          break;
        case 'dashboard_systems':
          embed = dashboardHandlers.createSystemsEmbed(dashboardData);
          break;
        case 'dashboard_activity':
          embed = dashboardHandlers.createActivityEmbed(dashboardData);
          break;
        default:
          embed = createMainDashboardEmbed(dashboardData);
      }

      await interaction.editReply({ embeds: [embed], components: [buttons] });
    } catch (error) {
      console.error('[Dashboard] Error in button handler:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Error en Dashboard',
          description: 'Error al cargar la vista del dashboard.',
          color: 0xe74c3c
        })]
      });
    }
    return;
  }

  // TOURNAMENT BUTTONS
  if (customId.startsWith("tournament_")) {
    if (customId.startsWith("tournament_join_")) {
      await interaction.deferUpdate(); // Actualizar el mensaje original
      const tournamentId = parseInt(customId.replace("tournament_join_", ""));

      const result = joinTournament(tournamentId, interaction.user.id);

      if (!result.success) {
        let errorMessage = '❌ Error al unirte al torneo.';
        switch (result.reason) {
          case 'not_available':
            errorMessage = '⏰ Este torneo ya no está disponible.';
            break;
          case 'already_joined':
            errorMessage = '✅ Ya estás participando en este torneo.';
            break;
          case 'full':
            errorMessage = '👥 Este torneo está lleno.';
            break;
          case 'insufficient_funds':
            errorMessage = '💰 No tienes suficiente saldo para la cuota de entrada.';
            break;
        }

        // Actualizar el mensaje con el error
      const tournament = getTournament(tournamentId);
      if (tournament) {
        const embed = createEmbed({
          title: `🏆 ${tournament.name}`,
          description: `${tournament.description}\n\n${getRandomMotivationalMessage()}`,
          fields: [
            {
              name: '🎮 JUEGO',
              value: `${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type.charAt(0).toUpperCase() + tournament.game_type.slice(1)}`,
              inline: true
            },
            {
              name: '⏰ DURACIÓN',
              value: `${Math.round((new Date(tournament.end_time) - new Date()) / (1000 * 60 * 60))} horas restantes`,
              inline: true
            },
            {
              name: '👥 PARTICIPANTES',
              value: `${getParticipantCount(tournamentId)}/${tournament.max_participants}`,
              inline: true
            },
            {
              name: '⚠️ ACCIÓN FALLIDA',
              value: errorMessage,
              inline: false
            }
          ],
          color: getStatusColor(tournament.status),
          footer: `ID: ${tournament.id} | ${getStatusEmoji(tournament.status)} ${tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}`
        });

        const buttons = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`tournament_join_${tournamentId}`)
            .setLabel('🎯 Unirme al Torneo')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`tournament_leave_${tournamentId}`)
            .setLabel('👋 Salir del Torneo')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('tournament_list')
            .setLabel('📋 Más Torneos')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`tournament_info_${tournamentId}`)
            .setLabel('📊 Ver Ranking')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [buttons] });
      }
        return;
      }

      // Actualizar el mensaje con éxito
      const tournament = result.tournament;
      const embed = createEmbed({
        title: `🏆 ${tournament.name}`,
        description: `${tournament.description}\n\n${getRandomMotivationalMessage()}`,
        fields: [
          {
            name: '🎮 JUEGO',
            value: `${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type.charAt(0).toUpperCase() + tournament.game_type.slice(1)}`,
            inline: true
          },
          {
            name: '⏰ DURACIÓN',
            value: `${Math.round((new Date(tournament.end_time) - new Date()) / (1000 * 60 * 60))} horas restantes`,
            inline: true
          },
          {
            name: '👥 PARTICIPANTES',
            value: `${getParticipantCount(tournamentId)}/${tournament.max_participants}`,
            inline: true
          },
          {
            name: '✅ ACCIÓN EXITOSA',
            value: `**${interaction.user.username}** se unió al torneo!\n💰 Cuota pagada: ${config.CURRENCY_SYMBOL} ${tournament.entry_fee.toLocaleString()}`,
            inline: false
          }
        ],
        color: getStatusColor(tournament.status),
        footer: `ID: ${tournament.id} | ${getStatusEmoji(tournament.status)} ${tournament.status === 'active' ? 'Activo - ¡Juega para ganar puntos!' : tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}`
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`tournament_join_${tournamentId}`)
          .setLabel('🎯 Unirme al Torneo')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`tournament_leave_${tournamentId}`)
          .setLabel('👋 Salir del Torneo')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('tournament_list')
          .setLabel('📋 Más Torneos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`tournament_info_${tournamentId}`)
          .setLabel('📊 Ver Ranking')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
      return;
    }

    if (customId.startsWith("tournament_leave_")) {
      await interaction.deferUpdate(); // Actualizar el mensaje original
      const tournamentId = parseInt(customId.replace("tournament_leave_", ""));

      const success = leaveTournament(tournamentId, interaction.user.id);

      if (!success) {
        // Actualizar el mensaje con el error
        const tournament = getTournament(tournamentId);
        if (tournament) {
          const embed = createEmbed({
            title: `🏆 ${tournament.name}`,
            description: `${tournament.description}\n\n${getRandomMotivationalMessage()}`,
            fields: [
              {
                name: '🎮 JUEGO',
                value: `${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type.charAt(0).toUpperCase() + tournament.game_type.slice(1)}`,
                inline: true
              },
              {
                name: '⏰ DURACIÓN',
                value: `${Math.round((new Date(tournament.end_time) - new Date()) / (1000 * 60 * 60))} horas restantes`,
                inline: true
              },
              {
                name: '👥 PARTICIPANTES',
                value: `${getParticipantCount(tournamentId)}/${tournament.max_participants}`,
                inline: true
              },
              {
                name: '⚠️ ACCIÓN FALLIDA',
                value: '❌ No puedes salir de este torneo. Puede que no estés participando o ya haya empezado.',
                inline: false
              }
            ],
            color: getStatusColor(tournament.status),
            footer: `ID: ${tournament.id} | ${getStatusEmoji(tournament.status)} ${tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}`
          });

          const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`tournament_join_${tournamentId}`)
              .setLabel('🎯 Unirme al Torneo')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`tournament_leave_${tournamentId}`)
              .setLabel('👋 Salir del Torneo')
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId('tournament_list')
              .setLabel('📋 Más Torneos')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`tournament_info_${tournamentId}`)
              .setLabel('📊 Ver Ranking')
              .setStyle(ButtonStyle.Secondary)
          );

          await interaction.editReply({ embeds: [embed], components: [buttons] });
        }
        return;
      }

      // Actualizar el mensaje con éxito
      const tournament = getTournament(tournamentId);
      const embed = createEmbed({
        title: `🏆 ${tournament.name}`,
        description: `${tournament.description}\n\n${getRandomMotivationalMessage()}`,
        fields: [
          {
            name: '🎮 JUEGO',
            value: `${getGameTypeEmoji(tournament.game_type)} ${tournament.game_type.charAt(0).toUpperCase() + tournament.game_type.slice(1)}`,
            inline: true
          },
          {
            name: '⏰ DURACIÓN',
            value: `${Math.round((new Date(tournament.end_time) - new Date()) / (1000 * 60 * 60))} horas restantes`,
            inline: true
          },
          {
            name: '👥 PARTICIPANTES',
            value: `${getParticipantCount(tournamentId)}/${tournament.max_participants}`,
            inline: true
          },
          {
            name: '👋 ACCIÓN EXITOSA',
            value: `**${interaction.user.username}** salió del torneo.\n💰 Cuota reembolsada: ${config.CURRENCY_SYMBOL} ${tournament.entry_fee.toLocaleString()}`,
            inline: false
          }
        ],
        color: getStatusColor(tournament.status),
        footer: `ID: ${tournament.id} | ${getStatusEmoji(tournament.status)} ${tournament.status === 'active' ? 'Activo - ¡Juega para ganar puntos!' : tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}`
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`tournament_join_${tournamentId}`)
          .setLabel('🎯 Unirme al Torneo')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`tournament_leave_${tournamentId}`)
          .setLabel('👋 Salir del Torneo')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('tournament_list')
          .setLabel('📋 Más Torneos')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`tournament_info_${tournamentId}`)
          .setLabel('📊 Ver Ranking')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({ embeds: [embed], components: [buttons] });
      return;
    }

    if (customId === "tournament_list") {
      await interaction.deferReply({ flags: 64 });

      const { getAllTournaments } = require("../database/tournaments");
      const tournaments = getAllTournaments();

      if (tournaments.length === 0) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: '🏆 Torneos Disponibles',
            description: 'No hay torneos activos en este momento.',
            color: 0x95a5a6
          })]
        });
      }

      const tournamentList = tournaments.slice(0, 5).map(tournament => {
        const participants = getParticipantCount(tournament.id);
        const statusEmoji = getStatusEmoji(tournament.status);

        return `**${statusEmoji} ${tournament.name}**\n🎮 ${getGameTypeEmoji(tournament.game_type)} | 👥 ${participants}/${tournament.max_participants} | 💰 ${config.CURRENCY_SYMBOL} ${tournament.entry_fee}`;
      }).join('\n\n');

      await interaction.editReply({
        embeds: [createEmbed({
          title: '🏆 Torneos Disponibles',
          description: tournamentList,
          color: 0x3498db,
          footer: 'Haz clic en "Unirme al Torneo" en cualquier torneo para participar'
        })]
      });
      return;
    }

    if (customId.startsWith("tournament_info_")) {
      await interaction.deferReply({ flags: 64 });
      const tournamentId = parseInt(customId.replace("tournament_info_", ""));

      const tournament = getTournament(tournamentId);
      if (!tournament) {
        return interaction.editReply({
          embeds: [errorEmbed('Torneo no encontrado.')]
        });
      }

      const participants = getTournamentParticipants(tournamentId);
      const ranking = participants
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((p, index) => `${index + 1}. <@${p.user_id}> - **${p.score}** puntos`)
        .join('\n');

      const embed = createEmbed({
        title: `🏆 Ranking: ${tournament.name}`,
        description: `**Sistema de puntos:** ${getTournamentPointsDescription(tournament.game_type)}\n\n**⏰ Termina:** ${new Date(tournament.end_time).toLocaleString('es-ES')}`,
        fields: [
          {
            name: '📊 RANKING ACTUAL',
            value: ranking || 'No hay participantes aún.',
            inline: false
          }
        ],
        color: getStatusColor(tournament.status),
        footer: `ID: ${tournament.id} | Participantes: ${participants.length}/${tournament.max_participants}`
      });

      await interaction.editReply({ embeds: [embed] });
      return;
    }
  }

  // DAILY REWARDS BUTTON
  if (customId.startsWith("daily_claim_")) {
    await interaction.deferReply({ flags: 64 });
    const userId = interaction.user.id;

    const result = claimDailyReward(userId);

    if (!result.success) {
      let errorMessage = "Error al reclamar la recompensa.";
      if (result.reason === 'already_claimed') {
        errorMessage = "Ya reclamaste tu recompensa diaria hoy.";
      }

      return interaction.editReply({
        embeds: [errorEmbed(errorMessage)],
      });
    }

    const embed = createEmbed({
      title: `🎉 ¡Recompensa Reclamada!`,
      description: `**¡Felicidades! Has reclamado tu recompensa diaria.**\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Monto recibido:** ${config.CURRENCY_SYMBOL} ${result.amount.toLocaleString()}\n🔥 **Nueva racha:** ${result.streak} día(s)\n🏆 **Mejor racha:** ${result.longestStreak} día(s)\n💵 **Saldo actual:** ${config.CURRENCY_SYMBOL} ${result.newBalance.toLocaleString()}\n\n━━━━━━━━━━━━━━━━━\n\n${result.streakBonus > 0 ? `🎯 **Bonificación por racha:** ${config.CURRENCY_SYMBOL} ${result.streakBonus.toLocaleString()}\n` : ''}¡Vuelve mañana para continuar tu racha y ganar aún más!`,
      color: 0x2ecc71,
      footer: 'Emerald Isle Casino ® - ¡Sigue reclamando!'
    });

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // MEMBERSHIPS BUTTONS
  if (
    customId === "membership_silver" ||
    customId === "membership_gold" ||
    customId === "membership_platinum"
  ) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_", "");
    const membership = getMembershipType(membershipType);

    if (!membership) {
      return interaction.editReply({
        embeds: [errorEmbed("Tipo de membresía no válido.")],
      });
    }

    let embed;
    if (membershipType === "silver") {
      embed = silverEmbed();
    } else if (membershipType === "gold") {
      embed = goldEmbed();
    } else {
      embed = platinumEmbed();
    }

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`membership_confirm_${membershipType}`)
        .setLabel("✅ Confirmar Compra")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("membership_cancel")
        .setLabel("❌ Cancelar")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    return;
  }

  if (customId.startsWith("membership_confirm_")) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_confirm_", "");
    const membership = getMembershipType(membershipType);
    const userId = interaction.user.id;

    if (!membership) {
      return interaction.editReply({
        embeds: [errorEmbed("Tipo de membresía no válido.")],
      });
    }

    const balance = economy.getBalance(userId);

    if (balance < membership.price) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            `No tienes suficiente saldo. Necesitas ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}, pero tienes ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}.`,
          ),
        ],
      });
    }

    // Verificar si ya tiene membresía activa
    const currentMembership = getUserMembership(userId);
    let showAlreadyActive = false;

    if (currentMembership) {
      showAlreadyActive = true;
      const alreadyActive = alreadyActiveEmbed(
        currentMembership.membership_type,
        currentMembership.expiration_date,
      );

      const confirmButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`membership_force_confirm_${membershipType}`)
          .setLabel("✅ Sí, Continuar")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("membership_cancel")
          .setLabel("❌ Cancelar")
          .setStyle(ButtonStyle.Danger),
      );

      return interaction.editReply({
        embeds: [alreadyActive],
        components: [confirmButtons],
      });
    }

    // Procesar compra
    economy.deductForBet(userId, membership.price);

    const startDate = new Date().toISOString();
    const expirationDate = calculateExpirationDate(startDate, 7);

    memberships.createMembership(
      userId,
      membershipType,
      startDate,
      expirationDate,
    );

    // Asignar rol de Discord automáticamente
    await assignMembershipRole(interaction.guild, userId, membershipType);

    const success = membershipSuccessEmbed(membershipType, expirationDate);

    // Enviar mensaje privado al usuario
    try {
      const dmEmbed = createEmbed({
        title: `✅ ${config.CASINO_NAME} - Membresía Activada`,
        description: `Tu membresía ${membership.emoji} ${membership.name} ha sido activada en ${config.CASINO_NAME}.\n\n⏰ **Válida hasta:** ${new Date(expirationDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}\n\n💎 ¡Disfruta de todos los beneficios exclusivos!`,
        color: membership.color,
        footer: "Emerald Isle Casino ®",
      });

      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error(`[Memberships] Error sending DM to ${userId}:`, error);
    }

    await interaction.editReply({ embeds: [success], components: [] });
    return;
  }

  if (customId.startsWith("membership_force_confirm_")) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_force_confirm_", "");
    const membership = getMembershipType(membershipType);
    const userId = interaction.user.id;

    if (!membership) {
      return interaction.editReply({
        embeds: [errorEmbed("Tipo de membresía no válido.")],
      });
    }

    const balance = economy.getBalance(userId);

    if (balance < membership.price) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            `No tienes suficiente saldo. Necesitas ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}, pero tienes ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}.`,
          ),
        ],
      });
    }

    // Cancelar membresía anterior y crear nueva
    memberships.cancelMembership(userId);
    economy.deductForBet(userId, membership.price);

    const startDate = new Date().toISOString();
    const expirationDate = calculateExpirationDate(startDate, 7);

    memberships.createMembership(
      userId,
      membershipType,
      startDate,
      expirationDate,
    );

    // Asignar rol de Discord automáticamente
    await assignMembershipRole(interaction.guild, userId, membershipType);

    const success = membershipSuccessEmbed(membershipType, expirationDate);

    // Enviar mensaje privado al usuario
    try {
      const dmEmbed = createEmbed({
        title: `✅ ${config.CASINO_NAME} - Membresía Activada`,
        description: `Tu membresía ${membership.emoji} ${membership.name} ha sido activada en ${config.CASINO_NAME}.\n\n⏰ **Válida hasta:** ${new Date(expirationDate).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}\n\n💎 ¡Disfruta de todos los beneficios exclusivos!`,
        color: membership.color,
        footer: "Emerald Isle Casino ®",
      });

      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (error) {
      console.error(`[Memberships] Error sending DM to ${userId}:`, error);
    }

    await interaction.editReply({ embeds: [success], components: [] });
    return;
  }

  if (customId === "membership_cancel") {
    await interaction.deferUpdate();
    await interaction.editReply({
      embeds: [
        createEmbed({
          description: "❌ Compra cancelada.",
          color: 0xff0000,
        }),
      ],
      components: [],
    });
    return;
  }

  // RENEW MEMBERSHIP BUTTONS
  if (customId.startsWith("membership_renew_")) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_renew_", "");
    const membership = getMembershipType(membershipType);
    const userId = interaction.user.id;

    if (!membership) {
      return interaction.editReply({
        embeds: [errorEmbed("Tipo de membresía no válido.")],
      });
    }

    const currentMembership = getUserMembership(userId);
    if (!currentMembership || currentMembership.membership_type.toLowerCase() !== membershipType) {
      return interaction.editReply({
        embeds: [errorEmbed("No tienes esta membresía activa para renovar.")],
      });
    }

    const balance = economy.getBalance(userId);

    if (balance < membership.price) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            `No tienes suficiente saldo para renovar. Necesitas ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}, pero tienes ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}.`,
          ),
        ],
      });
    }

    // Procesar renovación
    economy.deductForBet(userId, membership.price);

    const newExpirationDate = calculateExpirationDate(currentMembership.expiration_date, 7);

    memberships.updateMembershipExpiration(userId, newExpirationDate);

    // Asegurar que el rol esté asignado (por si acaso)
    await assignMembershipRole(interaction.guild, userId, membershipType);

    const successEmbed = createEmbed({
      title: `✅ ${config.CASINO_NAME} - Membresía Renovada`,
      description: `**¡Tu membresía ${membership.emoji} ${membership.name} ha sido renovada exitosamente!**\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Costo de renovación:** ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}\n⏰ **Nueva fecha de expiración:** ${new Date(newExpirationDate).toLocaleDateString("es-ES", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}\n\n━━━━━━━━━━━━━━━━━\n\n✨ **Todos tus beneficios continúan activos**`,
      color: membership.color,
      footer: "Emerald Isle Casino ® - ¡Gracias por renovar!",
    });

    await interaction.editReply({ embeds: [successEmbed], components: [] });
    return;
  }

  // CANCEL MEMBERSHIP BUTTONS
  if (customId.startsWith("membership_cancel_")) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_cancel_", "");
    const membership = getMembershipType(membershipType);
    const userId = interaction.user.id;

    if (!membership) {
      return interaction.editReply({
        embeds: [errorEmbed("Tipo de membresía no válido.")],
      });
    }

    const currentMembership = getUserMembership(userId);
    if (!currentMembership || currentMembership.membership_type.toLowerCase() !== membershipType) {
      return interaction.editReply({
        embeds: [errorEmbed("No tienes esta membresía activa para cancelar.")],
      });
    }

    // Confirmar cancelación
    const confirmEmbed = createEmbed({
      title: `⚠️ ${config.CASINO_NAME} - Confirmar Cancelación`,
      description: `**¿Estás seguro de que quieres cancelar tu membresía ${membership.emoji} ${membership.name}?**\n\n━━━━━━━━━━━━━━━━━\n\n⚠️ **Advertencia:** Perderás inmediatamente todos los beneficios:\n${membership.benefits.slice(0, 3).map(b => `• ${b}`).join('\n')}\n${membership.benefits.length > 3 ? `• ... y ${membership.benefits.length - 3} beneficios más` : ''}\n\n━━━━━━━━━━━━━━━━━\n\n💡 **Nota:** No hay reembolso por cancelación anticipada.`,
      color: 0xffa500,
      footer: "Emerald Isle Casino ® - Esta acción no se puede deshacer",
    });

    const confirmButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`membership_confirm_cancel_${membershipType}`)
        .setLabel("✅ Sí, Cancelar")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("membership_keep")
        .setLabel("❌ Mantener Membresía")
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [confirmEmbed], components: [confirmButtons] });
    return;
  }

  // CONFIRM CANCEL MEMBERSHIP
  if (customId.startsWith("membership_confirm_cancel_")) {
    await interaction.deferReply({ flags: 64 });
    const membershipType = customId.replace("membership_confirm_cancel_", "");
    const userId = interaction.user.id;

    memberships.expireMembership(userId);

    // Remover rol de Discord
    await removeAllMembershipRoles(interaction.guild, userId);

    const cancelEmbed = createEmbed({
      title: `❌ ${config.CASINO_NAME} - Membresía Cancelada`,
      description: `**Tu membresía ha sido cancelada exitosamente**\n\n━━━━━━━━━━━━━━━━━\n\n💡 **Todos los beneficios han sido removidos**\n\n💰 **Puedes adquirir una nueva membresía en cualquier momento**\n\n━━━━━━━━━━━━━━━━━\n\n*Gracias por haber sido parte de nuestra comunidad premium*`,
      color: 0xff0000,
      footer: "Emerald Isle Casino ® - ¡Te esperamos de vuelta!",
    });

    await interaction.editReply({ embeds: [cancelEmbed], components: [] });
    return;
  }

  // KEEP MEMBERSHIP (cancel cancelation)
  if (customId === "membership_keep") {
    await interaction.deferUpdate();
    await interaction.editReply({
      embeds: [
        createEmbed({
          description: "✅ Membresía mantenida. No se han realizado cambios.",
          color: 0x00ff00,
        }),
      ],
      components: [],
    });
    return;
  }

  // UPGRADE MEMBERSHIP
  if (customId === "membership_upgrade") {
    await interaction.deferReply({ flags: 64 });

    const embed = mainEmbed();

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("membership_silver")
        .setLabel("🥈 Silver")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("membership_gold")
        .setLabel("🥇 Gold")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("membership_platinum")
        .setLabel("💎 Platinum")
        .setStyle(ButtonStyle.Success),
    );

    await interaction.editReply({
      embeds: [embed],
      components: [buttons],
    });
    return;
  }
}

async function handleModal(interaction) {
  const customId = interaction.customId;

  if (customId.startsWith("sports_modal_")) {
    const parts = customId.split("_");
    const eventId = parseInt(parts[2]);
    const team = parts[3];

    const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        embeds: [errorEmbed("Introduce una cantidad válida.")],
        flags: 64,
      });
    }

    const balance = economy.getBalance(interaction.user.id);
    if (balance < amount) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `No tienes suficiente saldo. Tu balance: ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`,
          ),
        ],
        flags: 64,
      });
    }

    const event = sports.getEventById(eventId);
    if (!event || event.status !== "open") {
      return interaction.reply({
        embeds: [errorEmbed("Las apuestas están cerradas.")],
        flags: 64,
      });
    }

    let odds, teamName;
    switch (team) {
      case "team1":
        odds = event.team1_odds;
        teamName = event.team1_name;
        break;
      case "team2":
        odds = event.team2_odds;
        teamName = event.team2_name;
        break;
      case "draw":
        odds = event.draw_odds;
        teamName = "Empate";
        break;
    }

    let potentialWin = Math.floor(amount * odds);
    // Aplicar bono de membresía en ganancias potenciales
    potentialWin = applyBetBonus(interaction.user.id, potentialWin);

    economy.deductForBet(interaction.user.id, amount);
    sports.placeBet(eventId, interaction.user.id, team, amount, potentialWin);

    await interaction.reply({
      embeds: [
        successEmbed(`Apuesta realizada`, [
          { name: "Equipo", value: teamName, inline: true },
          {
            name: "Cantidad",
            value: `${config.CURRENCY_SYMBOL} ${amount.toLocaleString()}`,
            inline: true,
          },
          { name: "Cuota", value: odds.toFixed(2), inline: true },
          {
            name: "Ganancia Potencial",
            value: `${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}`,
            inline: true,
          },
        ]),
      ],
      flags: 64,
    });
    return;
  }

  if (customId.startsWith("bj_bet_modal_")) {
    await interaction.deferReply({ flags: 64 });
    const uid = customId.replace("bj_bet_modal_", "");

    const amountStr = interaction.fields.getTextInputValue("bet_amount");
    const amount = parseInt(amountStr);

    if (isNaN(amount) || amount <= 0) {
      return interaction.editReply({
        embeds: [errorEmbed("Introduce una cantidad válida mayor a 0.")]
      });
    }

    const bal = economy.getBalance(uid) || 0;
    const maxBet = getMaxBetLimit(uid);
    const minBet = getMinBetLimit(uid);

    if (amount < minBet) {
      return interaction.editReply({
        embeds: [errorEmbed(`La apuesta mínima es ${config.CURRENCY_SYMBOL} ${minBet.toLocaleString()}.`)]
      });
    }

    if (amount > maxBet) {
      return interaction.editReply({
        embeds: [errorEmbed(`La apuesta máxima es ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}.`)]
      });
    }

    if (bal < amount) {
      return interaction.editReply({
        embeds: [errorEmbed(`No tienes suficiente saldo. Tu balance: ${config.CURRENCY_SYMBOL} ${bal.toLocaleString()}`)]
      });
    }

    // Start blackjack game
    const g = bj.get(uid);
    if (!g) {
      bj.create(uid);
    }

    const game = bj.get(uid);
    game.bet = amount;

    economy.deductForBet(uid, amount);
    bj.deal(uid);

    const playerHand = bj.fh(game.ph);
    const dealerCard = bj.fh([game.dh[0]], true);

    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
      description: `🍀 <@${uid}>\n\n**TU MANO:** ${playerHand}\n**CARTA DEL BANCA:** ${dealerCard}\n\n💎 **Apuesta:** ${config.CURRENCY_SYMBOL} ${amount.toLocaleString()}\n\n*¿Qué deseas hacer?*`,
      color: 0x50c878
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`bj_hit_${uid}`)
        .setLabel("🃏 Pedir Carta")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`bj_stand_${uid}`)
        .setLabel("🛑 Quedarse")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`bj_double_${uid}`)
        .setLabel("💰 Doblar")
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
    return;
  }

  if (customId.startsWith("horse_modal_")) {
    const parts = customId.split("_");
    const raceId = parseInt(parts[2]);
    const horseIndex = parseInt(parts[3]);

    const amount = parseInt(interaction.fields.getTextInputValue("bet_amount"));

    if (isNaN(amount) || amount <= 0) {
      return interaction.reply({
        embeds: [errorEmbed("Introduce una cantidad válida.")],
        flags: 64,
      });
    }

    const minBet = getMinBetLimit(interaction.user.id);
    const maxBet = getMaxBetLimit(interaction.user.id);

    if (amount < minBet) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `❌ La apuesta mínima es ${config.CURRENCY_SYMBOL} ${minBet}.`,
          ),
        ],
        flags: 64,
      });
    }

    if (amount > maxBet) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `❌ La apuesta máxima es ${config.CURRENCY_SYMBOL} ${maxBet.toLocaleString()}.`,
          ),
        ],
        flags: 64,
      });
    }

    const balance = economy.getBalance(interaction.user.id);
    if (balance < amount) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `No tienes suficiente saldo. Tu balance: ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`,
          ),
        ],
        flags: 64,
      });
    }

    const race = insidetrack.getRaceById(raceId);
    if (!race || race.status !== "betting") {
      return interaction.reply({
        embeds: [errorEmbed("Las apuestas están cerradas.")],
        flags: 64,
      });
    }

    const horse = race.horses[horseIndex];
    let potentialWin = Math.floor(amount * horse.odds);
    // Aplicar bono de membresía en ganancias potenciales
    potentialWin = applyBetBonus(interaction.user.id, potentialWin);

    economy.deductForBet(interaction.user.id, amount);
    insidetrack.placeBet(
      raceId,
      interaction.user.id,
      horseIndex,
      amount,
      horse.odds,
    );

    await interaction.reply({
      embeds: [
        successEmbed(`Apuesta realizada`, [
          {
            name: "Caballo",
            value: `${horse.emoji} ${horse.name}`,
            inline: true,
          },
          {
            name: "Cantidad",
            value: `${config.CURRENCY_SYMBOL} ${amount.toLocaleString()}`,
            inline: true,
          },
          { name: "Cuota", value: horse.odds.toFixed(2), inline: true },
          {
            name: "Ganancia Potencial",
            value: `${config.CURRENCY_SYMBOL} ${potentialWin.toLocaleString()}`,
            inline: true,
          },
        ]),
      ],
      flags: 64,
    });
    return;
  }

}
