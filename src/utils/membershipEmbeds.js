const { createEmbed } = require("./embedBuilder");
const {
  MEMBERSHIP_TYPES,
  getMembershipType,
  formatMembershipType,
} = require("./memberships");
const config = require("./config");

function mainEmbed() {
  const silver = MEMBERSHIP_TYPES.silver;
  const gold = MEMBERSHIP_TYPES.gold;
  const platinum = MEMBERSHIP_TYPES.platinum;

  return createEmbed({
    title: `💎 ${config.CASINO_NAME} - Membresías Premium`,
    description: `**¡Únete a la élite de ${config.CASINO_NAME}!**\n\nObtén beneficios exclusivos y acceso premium a todas las funciones del casino.\n\n━━━━━━━━━━━━━━━━━\n\n**${silver.emoji} ${silver.name}** - ${config.CURRENCY_SYMBOL} ${silver.price.toLocaleString()}/semana\n**${gold.emoji} ${gold.name}** - ${config.CURRENCY_SYMBOL} ${gold.price.toLocaleString()}/semana\n**${platinum.emoji} ${platinum.name}** - ${config.CURRENCY_SYMBOL} ${platinum.price.toLocaleString()}/semana\n\n━━━━━━━━━━━━━━━━━\n\n*Haz clic en un botón para ver más detalles*`,
    color: config.EMBED_COLOR,
    footer: "Emerald Isle Casino ® - Elige tu membresía",
  });
}

function silverEmbed() {
  const membership = MEMBERSHIP_TYPES.silver;

  return createEmbed({
    title: `${membership.emoji} ${config.CASINO_NAME} - Membresía ${membership.name}`,
    description: `**¡Únete a la élite Silver de ${config.CASINO_NAME}!**\n\n${membership.benefits.map((b) => `✨ ${b}`).join("\n")}\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Precio Semanal:** ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}\n\n⏰ **Duración:** 7 días\n\n💎 **Beneficios exclusivos para miembros Silver**`,
    color: membership.color,
    footer: "Emerald Isle Casino ® - Membresías Premium",
  });
}

function goldEmbed() {
  const membership = MEMBERSHIP_TYPES.gold;

  return createEmbed({
    title: `${membership.emoji} ${config.CASINO_NAME} - Membresía ${membership.name}`,
    description: `**¡Únete a la élite Gold de ${config.CASINO_NAME}!**\n\n${membership.benefits.map((b) => `✨ ${b}`).join("\n")}\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Precio Semanal:** ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}\n\n⏰ **Duración:** 7 días\n\n💎 **Beneficios exclusivos para miembros Gold**`,
    color: membership.color,
    footer: "Emerald Isle Casino ® - Membresías Premium",
  });
}

function platinumEmbed() {
  const membership = MEMBERSHIP_TYPES.platinum;

  return createEmbed({
    title: `${membership.emoji} ${config.CASINO_NAME} - Membresía ${membership.name}`,
    description: `**¡Únete a la élite Platinum de ${config.CASINO_NAME}!**\n\n${membership.benefits.map((b) => `✨ ${b}`).join("\n")}\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Precio Semanal:** ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}\n\n⏰ **Duración:** 7 días\n\n💎 **Beneficios exclusivos para miembros Platinum**`,
    color: membership.color,
    footer: "Emerald Isle Casino ® - Membresías Premium",
  });
}

function confirmationEmbed(membershipType) {
  const membership = getMembershipType(membershipType);

  if (!membership) {
    return createEmbed({
      description: "❌ Tipo de membresía no válido",
      color: 0xff0000,
    });
  }

  return createEmbed({
    title: `🤔 ${config.CASINO_NAME} - Confirmar Compra`,
    description: `**¿Estás seguro de que deseas comprar la membresía ${membership.emoji} ${membership.name}?**\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Precio:** ${config.CURRENCY_SYMBOL} ${membership.price.toLocaleString()}\n\n⏰ **Duración:** 7 días\n\n✨ **Beneficios:**\n${membership.benefits
      .slice(0, 3)
      .map((b) => `• ${b}`)
      .join(
        "\n",
      )}\n${membership.benefits.length > 3 ? `• ... y ${membership.benefits.length - 3} beneficios más` : ""}\n\n━━━━━━━━━━━━━━━━━\n\n*Haz clic en "Confirmar compra" para proceder*`,
    color: membership.color,
    footer: "Emerald Isle Casino ® - Confirma tu compra",
  });
}

function membershipSuccessEmbed(membershipType, expirationDate) {
  const membership = getMembershipType(membershipType);

  if (!membership) {
    return createEmbed({
      description: "❌ Error al procesar la membresía",
      color: 0xff0000,
    });
  }

  const expiration = new Date(expirationDate);
  const formattedDate = expiration.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return createEmbed({
    title: `✅ ${config.CASINO_NAME} - Membresía Activada`,
    description: `**¡Felicidades! Tu membresía ${membership.emoji} ${membership.name} ha sido activada.**\n\n━━━━━━━━━━━━━━━━━\n\n✨ **Beneficios activos:**\n${membership.benefits.map((b) => `• ${b}`).join("\n")}\n\n━━━━━━━━━━━━━━━━━\n\n⏰ **Válida hasta:** ${formattedDate}\n\n💎 **¡Disfruta de todos los beneficios exclusivos!**`,
    color: membership.color,
    footer: "Emerald Isle Casino ® - ¡Bienvenido a la élite!",
  });
}

function alreadyActiveEmbed(membershipType, expirationDate) {
  const expiration = new Date(expirationDate);
  const formattedDate = expiration.toLocaleDateString("es-ES", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return createEmbed({
    title: `⚠️ ${config.CASINO_NAME} - Membresía Ya Activa`,
    description: `**Ya tienes una membresía activa: ${formatMembershipType(membershipType)}**\n\n━━━━━━━━━━━━━━━━━\n\n⏰ **Válida hasta:** ${formattedDate}\n\n💡 **Nota:** Si compras una nueva membresía, la anterior será cancelada y se activará la nueva.\n\n*¿Deseas continuar con la compra?*`,
    color: 0xffa500,
    footer: "Emerald Isle Casino ® - Membresías",
  });
}

module.exports = {
  mainEmbed,
  silverEmbed,
  goldEmbed,
  platinumEmbed,
  confirmationEmbed,
  membershipSuccessEmbed,
  alreadyActiveEmbed,
};
