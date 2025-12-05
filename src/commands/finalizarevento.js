const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const sports = require("../database/sports");
const economy = require("../database/economy");
const { createEmbed, errorEmbed } = require("../utils/embedBuilder");
const config = require("../utils/config");
const { recordWeeklyLoss } = require("../database/memberships");

const SPORTS = {
  futbol: "⚽",
  basket: "🏀",
  beisbol: "⚾",
  nascar: "🏎️",
  boxeo: "🥊",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("finalizarevento")
    .setDescription("Finaliza un evento y paga a los ganadores")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((option) =>
      option.setName("id").setDescription("ID del evento").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("ganador")
        .setDescription("Equipo ganador")
        .setRequired(true)
        .addChoices(
          { name: "Equipo 1", value: "team1" },
          { name: "Equipo 2", value: "team2" },
          { name: "Empate", value: "draw" },
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const eventId = interaction.options.getInteger("id");
    const winner = interaction.options.getString("ganador");

    const event = sports.getEventById(eventId);
    if (!event) {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            `❌ Evento ID ${eventId} no encontrado.\n\nUsa /eventos para ver los IDs disponibles.`,
          ),
        ],
      });
    }

    if (event.channel_id !== interaction.channel.id) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ Este evento no pertenece a este canal.")],
      });
    }

    if (event.status === "finished") {
      return interaction.editReply({
        embeds: [errorEmbed("❌ Este evento ya fue finalizado.")],
      });
    }

    if (winner === "draw" && !event.draw_odds) {
      return interaction.editReply({
        embeds: [errorEmbed("❌ Este evento no tiene opción de empate.")],
      });
    }

    if (event.status === "open") {
      sports.closeEvent(eventId);
    }

    const { winningBets, losingBets, totalPaidOut } = sports.finalizeEvent(
      eventId,
      winner,
    );

    let winnerName;
    switch (winner) {
      case "team1":
        winnerName = event.team1_name;
        break;
      case "team2":
        winnerName = event.team2_name;
        break;
      case "draw":
        winnerName = "Empate";
        break;
    }

    for (const bet of winningBets) {
      economy.addWinnings(bet.user_id, bet.potential_win);
    }

    // Registrar pérdidas netas para cashback semanal
    for (const bet of losingBets) {
      recordWeeklyLoss(bet.user_id, bet.amount);
    }

    let winners = "";
    for (const bet of winningBets.slice(0, 5)) {
      try {
        const user = await interaction.client.users.fetch(bet.user_id);
        winners += `${user.username}: +${config.CURRENCY_SYMBOL} ${bet.potential_win}\n`;
      } catch {
        winners += `Usuario ${bet.user_id}: +${config.CURRENCY_SYMBOL} ${bet.potential_win}\n`;
      }
    }
    if (winningBets.length > 5)
      winners += `... y ${winningBets.length - 5} más`;
    if (!winners) winners = "Sin ganadores";

    const emoji = SPORTS[event.sport] || "🎯";

    const publicEmbed = createEmbed({
      title: `${config.CASINO_NAME} - 🏆 ${emoji} EVENTO FINALIZADO`,
      description: `**${event.title}**\n\n🎉 **¡Ganador: ${winnerName}!**\n\n👥 **${winningBets.length} ganador(es)**`,
      fields: [{ name: "Premios Pagados", value: winners || "Sin ganadores" }],
      color: 0xffd700,
    });

    try {
      const msg = await interaction.channel.messages.fetch(event.message_id);
      await msg.edit({ embeds: [publicEmbed], components: [] });
    } catch {}

    // Actualizar mesa permanente
    const boardMsg = sports.getEventsBoardMessage(interaction.channel.id);
    if (boardMsg) {
      try {
        const boardChannel = interaction.channel;
        const boardMessage = await boardChannel.messages.fetch(
          boardMsg.message_id,
        );

        const {
          ActionRowBuilder,
          ButtonBuilder,
          ButtonStyle,
        } = require("discord.js");
        const SPORTS_FULL = {
          futbol: "⚽",
          basket: "🏀",
          beisbol: "⚾",
          nascar: "🏎️",
          boxeo: "🥊",
        };

        const allEvents = sports
          .getChannelActiveEvents(interaction.channel.id)
          .slice(0, 5);
        let boardDescription = "🍀 **═══ EVENTOS DISPONIBLES ═══** 🍀\n\n";
        if (allEvents.length === 0) {
          boardDescription += "*No hay eventos activos*";
        } else {
          allEvents.forEach((e) => {
            const eEmoji = SPORTS_FULL[e.sport] || "🎯";
            const status = e.status === "open" ? "🟢 Abierto" : "🔴 Cerrado";
            boardDescription += `${eEmoji} **${e.title}**\n`;
            boardDescription += `🥋 **${e.team1_name} vs ${e.team2_name}**\n`;
            boardDescription += `${status}\n\n`;
          });
        }

        const buttons = allEvents.map((e) =>
          new ButtonBuilder()
            .setCustomId(`event_select_${e.id}`)
            .setLabel(
              `${e.team1_name} vs ${e.team2_name} (ID: ${e.id})`.substring(
                0,
                80,
              ),
            )
            .setStyle(ButtonStyle.Primary),
        );

        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(
            new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)),
          );
        }

        await boardMessage.edit({
          embeds: [
            createEmbed({
              title: `🍀 ${config.CASINO_NAME} - APUESTAS DEPORTIVAS 🍀`,
              description: boardDescription,
              color: 0x50c878,
              footer: `Total: ${allEvents.length} evento(s) | Mesa Permanente`,
            }),
          ],
          components: rows.length > 0 ? rows : [],
        });
      } catch (e) {
        console.log("No se pudo actualizar mesa permanente:", e.message);
      }
    }

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: `✅ Evento ${eventId} Finalizado`,
          fields: [
            { name: "Ganador", value: winnerName, inline: true },
            {
              name: "Ganadores",
              value: winningBets.length.toString(),
              inline: true,
            },
            {
              name: "Perdedores",
              value: losingBets.length.toString(),
              inline: true,
            },
            {
              name: "Total Pagado",
              value: `${config.CURRENCY_SYMBOL} ${totalPaidOut}`,
              inline: true,
            },
          ],
          color: 0x00ff00,
        }),
      ],
    });
  },
};
