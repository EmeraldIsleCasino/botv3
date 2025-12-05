const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { mainEmbed } = require("../utils/membershipEmbeds");
const { errorEmbed } = require("../utils/embedBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("membresias")
    .setDescription("Sistema de membresías de Emerald Isle Casino")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("publicar")
        .setDescription("Publica el mensaje de membresías en el canal actual"),
    ),

  async execute(interaction) {
    if (interaction.options.getSubcommand() === "publicar") {
      // Verificar permisos de administrador
      if (
        !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)
      ) {
        return interaction.reply({
          embeds: [
            errorEmbed("Solo los administradores pueden usar este comando."),
          ],
          flags: 64,
        });
      }

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

      await interaction.reply({
        embeds: [embed],
        components: [buttons],
      });
    }
  },
};
