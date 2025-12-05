const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const giveaways = require("../database/giveaways");
const { createEmbed, errorEmbed } = require("../utils/embedBuilder");
const config = require("../utils/config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("participantes")
    .setDescription("Ver los participantes del sorteo activo en este canal")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const giveaway = giveaways.getActiveGiveaway(interaction.channel.id);

    if (!giveaway) {
      return interaction.editReply({
        embeds: [errorEmbed("No hay un sorteo activo en este canal.")],
      });
    }

    const participants = giveaways.getParticipants(giveaway.id);
    const count = participants.length;

    if (count === 0) {
      return interaction.editReply({
        embeds: [
          createEmbed({
            title: `${config.CASINO_NAME} - 🎉 Participantes del Sorteo`,
            description: `**🎁 Premio:** ${giveaway.prize}\n\n👥 **Total de participantes:** 0\n\n*Aún no hay participantes en este sorteo.*`,
            color: config.EMBED_COLOR,
            footer: "Emerald Isle Casino ®",
          }),
        ],
      });
    }

    // Obtener información de usuarios de Discord
    const userIds = participants.map((p) => p.user_id);
    const userMentions = [];
    const userNames = [];

    for (const userId of userIds) {
      try {
        const user = await interaction.client.users.fetch(userId);
        userMentions.push(`<@${userId}>`);
        userNames.push(`${user.username} (${user.id})`);
      } catch (error) {
        // Si no se puede obtener el usuario, mostrar solo el ID
        userMentions.push(`<@${userId}>`);
        userNames.push(`Usuario desconocido (${userId})`);
      }
    }

    // Dividir en chunks si hay muchos participantes (Discord limita a 2000 caracteres por field)
    const maxPerField = 20; // Máximo de usuarios por field para evitar límites
    const fields = [];

    for (let i = 0; i < userMentions.length; i += maxPerField) {
      const chunk = userMentions.slice(i, i + maxPerField);
      const chunkNames = userNames.slice(i, i + maxPerField);

      fields.push({
        name: `👥 Participantes ${i + 1}-${Math.min(i + maxPerField, userMentions.length)}`,
        value: chunk.join("\n") || "Ninguno",
        inline: false,
      });
    }

    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 🎉 Participantes del Sorteo`,
      description: `**🎁 Premio:** ${giveaway.prize}\n\n👥 **Total de participantes:** ${count}\n\n━━━━━━━━━━━━━━━━━`,
      fields,
      color: config.EMBED_COLOR,
      footer: "Emerald Isle Casino ® - Lista de participantes",
    });

    await interaction.editReply({ embeds: [embed] });
  },
};
