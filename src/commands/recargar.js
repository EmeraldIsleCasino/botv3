const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const economy = require("../database/economy");
const { successEmbed, errorEmbed } = require("../utils/embedBuilder");
const config = require("../utils/config");
const {
  getUserMembership,
  getDepositBonus,
  formatMembershipType,
} = require("../utils/memberships");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recargar")
    .setDescription("Añade saldo a un usuario")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) =>
      option
        .setName("usuario")
        .setDescription("Usuario al que añadir saldo")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("cantidad")
        .setDescription("Cantidad a añadir")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const user = interaction.options.getUser("usuario");
    const amount = interaction.options.getInteger("cantidad");

    // Verificar si tiene membresía activa para aplicar bonificación
    const membership = getUserMembership(user.id);
    const bonusPercent = getDepositBonus(user.id);
    const bonusAmount =
      bonusPercent > 0 ? Math.floor(amount * bonusPercent) : 0;
    const totalAmount = amount + bonusAmount;

    const newBalance = economy.addBalance(
      user.id,
      totalAmount,
      interaction.user.id,
      `Recarga por administrador${bonusAmount > 0 ? ` + Bono ${(bonusPercent * 100).toFixed(0)}%` : ""}`,
    );

    const fields = [
      {
        name: "Cantidad Base",
        value: `${config.CURRENCY_SYMBOL} ${amount.toLocaleString()}`,
        inline: true,
      },
      {
        name: "Nuevo Balance",
        value: `${config.CURRENCY_SYMBOL} ${newBalance.toLocaleString()}`,
        inline: true,
      },
      {
        name: "Administrador",
        value: interaction.user.toString(),
        inline: true,
      },
    ];

    if (bonusAmount > 0) {
      fields.splice(1, 0, {
        name: `🎁 Bono ${membership ? formatMembershipType(membership.membership_type) : ""}`,
        value: `${config.CURRENCY_SYMBOL} ${bonusAmount.toLocaleString()} (+${(bonusPercent * 100).toFixed(0)}%)`,
        inline: true,
      });
    }

    const embed = successEmbed(
      `Se han añadido **${config.CURRENCY_SYMBOL} ${totalAmount.toLocaleString()}** a ${user.toString()}${bonusAmount > 0 ? ` (incluye bono de membresía)` : ""}`,
      fields,
    );

    await interaction.editReply({ embeds: [embed] });
  },
};
