const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const insidetrack = require("../database/insidetrack");
const economy = require("../database/economy");
const { createEmbed, errorEmbed } = require("../utils/embedBuilder");
const config = require("../utils/config");
const { recordWeeklyLoss } = require("../database/memberships");

const activeRaceChannels = new Set();

function generateHorses() {
  const shuffledNames = [...config.HORSE_NAMES].sort(() => Math.random() - 0.5);
  const horses = [];

  for (let i = 0; i < 5; i++) {
    const odds = (Math.random() * 1 + 1.5).toFixed(2);
    horses.push({
      name: shuffledNames[i],
      emoji: config.HORSE_EMOJIS[i % config.HORSE_EMOJIS.length],
      odds: parseFloat(odds),
      position: 0,
    });
  }

  return horses;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("insidetrack")
    .setDescription(
      "Inicia una nueva carrera de caballos (o activa el modo automático)",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const existingRace = insidetrack.getActiveRace(interaction.channel.id);
    if (existingRace && existingRace.status === "betting") {
      return interaction.editReply({
        embeds: [
          errorEmbed(
            "Ya hay una carrera activa en este canal. Espera a que termine.",
          ),
        ],
      });
    }

    activeRaceChannels.add(interaction.channel.id);
    await startNewRace(interaction.channel, true);

    await interaction.editReply({
      embeds: [
        createEmbed({
          description:
            "✅ Carreras automáticas iniciadas. Se generarán nuevas carreras automáticamente cada 5 minutos.",
        }),
      ],
    });
  },
};

async function startNewRace(channel, isFirstRace = false) {
  if (!activeRaceChannels.has(channel.id)) {
    return;
  }

  const horses = generateHorses();

  let description = "🏇 **¡La carrera está por comenzar!**\n\n";
  description += "**Caballos participantes:**\n\n";

  horses.forEach((horse, index) => {
    description += `${horse.emoji} **${index + 1}. ${horse.name}** - Cuota: \`${horse.odds.toFixed(2)}\`\n`;
  });

  description +=
    "\n*Haz clic en un botón para apostar por tu caballo favorito*";

  const embed = createEmbed({
    title: `${config.CASINO_NAME} - 🏇 INSIDE TRACK`,
    description,
    fields: [
      { name: "📊 Estado", value: "🟢 Apuestas Abiertas", inline: true },
      { name: "⏱️ Tiempo", value: "1 minuto para apostar", inline: true },
    ],
    footer: "Emerald Isle Casino ® - ¡Que gane el mejor!",
  });

  const buttons = horses.map((horse, index) =>
    new ButtonBuilder()
      .setCustomId(`horse_bet_${index}`)
      .setLabel(`${index + 1}. ${horse.name.substring(0, 15)}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji(horse.emoji),
  );

  const row1 = new ActionRowBuilder().addComponents(buttons.slice(0, 3));
  const row2 = new ActionRowBuilder().addComponents(buttons.slice(3, 5));

  const message = await channel.send({
    embeds: [embed],
    components: [row1, row2],
  });

  const raceId = insidetrack.createRace(channel.id, message.id, horses);

  setTimeout(async () => {
    if (!activeRaceChannels.has(channel.id)) return;

    const race = insidetrack.getRaceById(raceId);
    if (race && race.status === "betting") {
      await runRace(channel, race, horses);
    }
  }, 60000);
}

async function runRace(channel, race, horses) {
  if (!activeRaceChannels.has(channel.id)) return;

  insidetrack.startRace(race.id);

  const trackLength = config.TRACK_LENGTH;
  const positions = horses.map(() => 0);
  const raceUpdates = Math.floor(
    config.RACE_DURATION / config.RACE_UPDATE_INTERVAL,
  );

  let message;
  try {
    message = await channel.messages.fetch(race.message_id);
  } catch {
    return;
  }

  const narrations = [
    "¡Y arrancan!",
    "¡La carrera está muy reñida!",
    "¡Se acercan a la mitad del recorrido!",
    "¡Cambio de posiciones!",
    "¡Qué emoción!",
    "¡Un caballo toma la delantera!",
    "¡Se acercan a la recta final!",
    "¡Los últimos metros!",
    "¡Foto finish!",
    "¡Y tenemos un ganador!",
  ];

  for (let update = 0; update < raceUpdates; update++) {
    await new Promise((resolve) =>
      setTimeout(resolve, config.RACE_UPDATE_INTERVAL),
    );

    horses.forEach((horse, index) => {
      const speed = Math.random() * 5 + 0.5;
      positions[index] = Math.min(positions[index] + speed, trackLength);
    });

    const sortedHorses = horses
      .map((horse, index) => ({ ...horse, index, position: positions[index] }))
      .sort((a, b) => b.position - a.position);

    let raceTrack = "🏁 **CARRERA EN PROGRESO** 🏁\n\n";
    raceTrack += `*${narrations[Math.min(update, narrations.length - 1)]}*\n\n`;

    sortedHorses.forEach((horse, rank) => {
      const progress = Math.floor((horse.position / trackLength) * 15);
      const track =
        "░".repeat(progress) + horse.emoji + "░".repeat(15 - progress) + "🏁";
      const medal =
        rank === 0 ? "🥇" : rank === 1 ? "🥈" : rank === 2 ? "🥉" : "  ";
      raceTrack += `${medal} ${track} **${horse.name}**\n`;
    });

    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🏇 INSIDE TRACK`,
      description: raceTrack,
      fields: [
        { name: "📊 Estado", value: "🏃 Carrera en curso", inline: true },
      ],
      color: 0xffd700,
    });

    try {
      await message.edit({ embeds: [embed], components: [] });
    } catch {
      return;
    }
  }

  const finalPositions = horses
    .map((horse, index) => ({ ...horse, index, position: positions[index] }))
    .sort((a, b) => b.position - a.position);

  const winnerIndex = finalPositions[0].index;
  const winnerHorse = horses[winnerIndex];

  const { winningBets, losingBets, totalPaidOut } = insidetrack.finishRace(
    race.id,
    winnerIndex,
  );

  for (const bet of winningBets) {
    const winAmount = Math.floor(bet.amount * bet.odds);
    economy.addWinnings(bet.user_id, winAmount);
  }

  // Registrar pérdidas netas para cashback semanal
  for (const bet of losingBets) {
    recordWeeklyLoss(bet.user_id, bet.amount);
  }

  let finalTrack = "🏆 **¡CARRERA FINALIZADA!** 🏆\n\n";
  finalTrack += `🥇 **GANADOR: ${winnerHorse.emoji} ${winnerHorse.name}**\n\n`;
  finalTrack += "**Posiciones finales:**\n";

  finalPositions.forEach((horse, rank) => {
    const medal =
      rank === 0
        ? "🥇"
        : rank === 1
          ? "🥈"
          : rank === 2
            ? "🥉"
            : `${rank + 1}.`;
    finalTrack += `${medal} ${horse.emoji} ${horse.name}\n`;
  });

  let winnersText = "";
  for (const bet of winningBets) {
    try {
      const user = await channel.client.users.fetch(bet.user_id);
      winnersText += `<@${bet.user_id}> `;
    } catch {}
  }

  finalTrack += `\n👥 **Ganadores:** ${winnersText || "Sin ganadores"}`;

  const publicEmbed = createEmbed({
    title: `${config.CASINO_NAME} - 🏇 INSIDE TRACK`,
    description: finalTrack,
    color: 0xffd700,
    footer: "🔄 Nueva carrera en 5 minutos...",
  });

  try {
    await message.edit({ embeds: [publicEmbed], components: [] });
  } catch {}

  if (winningBets.length > 0) {
    let winnersInfo = "";
    for (const bet of winningBets) {
      const winAmount = Math.floor(bet.amount * bet.odds);
      try {
        const user = await channel.client.users.fetch(bet.user_id);
        winnersInfo += `${user.tag}: Apostó ${config.CURRENCY_SYMBOL}${bet.amount} → Ganó ${config.CURRENCY_SYMBOL}${winAmount}\n`;
      } catch {
        winnersInfo += `Usuario ${bet.user_id}: Apostó ${config.CURRENCY_SYMBOL}${bet.amount} → Ganó ${config.CURRENCY_SYMBOL}${winAmount}\n`;
      }
    }

    const adminEmbed = createEmbed({
      title: `${config.CASINO_NAME} - 📊 Reporte de Carrera`,
      description: `**Ganador:** ${winnerHorse.emoji} ${winnerHorse.name}`,
      fields: [
        {
          name: "💸 Total Pagado",
          value: `${config.CURRENCY_SYMBOL} ${totalPaidOut.toLocaleString()}`,
          inline: true,
        },
        {
          name: "👥 Ganadores",
          value: winningBets.length.toString(),
          inline: true,
        },
        {
          name: "\n📋 Detalle de Ganadores",
          value: `\`\`\`\n${winnersInfo}\`\`\``,
        },
      ],
      footer: "Información confidencial - Solo administradores",
    });

    const adminRole = channel.guild.roles.cache.find((r) =>
      r.permissions.has("Administrator"),
    );
    if (adminRole) {
      try {
        const adminMember = channel.guild.members.cache.find((m) =>
          m.permissions.has("Administrator"),
        );
        if (adminMember) {
          await adminMember.send({ embeds: [adminEmbed] }).catch(() => {});
        }
      } catch {}
    }
  }

  if (activeRaceChannels.has(channel.id)) {
    setTimeout(() => {
      if (activeRaceChannels.has(channel.id)) {
        startNewRace(channel);
      }
    }, 300000);
  }
}
