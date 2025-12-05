const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');
const {
  getUserMembership,
  hasActiveMembership,
  formatMembershipType,
  MEMBERSHIP_TYPES,
  calculateCashback,
  getMaxBetLimit,
  getDepositBonus
} = require('../utils/memberships');
const economy = require('../database/economy');
const { mainEmbed } = require('../utils/membershipEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mimembresia')
    .setDescription('Ver el estado de tu membresía actual y beneficios'),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    const userId = interaction.user.id;
    const membership = getUserMembership(userId);
    const balance = economy.getBalance(userId);

    if (!membership) {
      // Usuario sin membresía
      const embed = createEmbed({
        title: `👤 ${config.CASINO_NAME} - Estado de Membresía`,
        description: `**No tienes una membresía activa actualmente**\n\n━━━━━━━━━━━━━━━━━\n\n💡 **¿Quieres acceder a beneficios exclusivos?**\n\n• 🥈 **Silver:** Bonos de depósito, cashback semanal, límites más altos\n• 🥇 **Gold:** Beneficios premium, sorteos exclusivos, soporte VIP\n• 💎 **Platinum:** Máximos beneficios, acceso anticipado, badge especial\n\n━━━━━━━━━━━━━━━━━\n\n💰 **Tu saldo actual:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}`,
        color: 0x95a5a6,
        footer: 'Emerald Isle Casino ® - ¡Únete a la élite!'
      });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('membership_silver')
          .setLabel('🥈 Silver')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('membership_gold')
          .setLabel('🥇 Gold')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('membership_platinum')
          .setLabel('💎 Platinum')
          .setStyle(ButtonStyle.Success)
      );

      return interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
    }

    // Usuario con membresía activa
    const membershipType = MEMBERSHIP_TYPES[membership.membership_type.toLowerCase()];
    const expirationDate = new Date(membership.expiration_date);
    const now = new Date();
    const daysLeft = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));

    // Calcular estadísticas de membresía
    const weeklyStats = economy.getWeeklyStats(userId);
    const cashbackRate = membershipType.cashbackRate;
    const potentialCashback = calculateCashback(userId, weeklyStats.totalLoss || 0);

    const embed = createEmbed({
      title: `👤 ${config.CASINO_NAME} - Tu Membresía ${membershipType.emoji} ${membershipType.name}`,
      description: `**¡Bienvenido de vuelta, miembro premium!**\n\n━━━━━━━━━━━━━━━━━\n\n⏰ **Estado:** ✅ **ACTIVA**\n📅 **Expira en:** ${daysLeft} día(s)\n📆 **Fecha exacta:** ${expirationDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}\n\n━━━━━━━━━━━━━━━━━`,
      fields: [
        {
          name: '💎 BENEFICIOS ACTIVOS',
          value: membershipType.benefits.map(benefit => `• ${benefit}`).join('\n'),
          inline: false
        },
        {
          name: '📊 ESTADÍSTICAS SEMANALES',
          value: `💰 **Saldo actual:** ${config.CURRENCY_SYMBOL} ${balance.toLocaleString()}\n💸 **Pérdidas esta semana:** ${config.CURRENCY_SYMBOL} ${(weeklyStats.totalLoss || 0).toLocaleString()}\n🎁 **Cashback disponible:** ${config.CURRENCY_SYMBOL} ${potentialCashback.toLocaleString()} (${(cashbackRate * 100).toFixed(0)}%)\n🎯 **Límite máximo de apuesta:** ${config.CURRENCY_SYMBOL} ${getMaxBetLimit(userId).toLocaleString()}`,
          inline: false
        },
        {
          name: '⚡ ACCIONES DISPONIBLES',
          value: '🔄 **Renovar membresía** antes de que expire\n❌ **Cancelar membresía** (se perderán beneficios)\n📈 **Ver estadísticas detalladas**',
          inline: false
        }
      ],
      color: membershipType.color,
      footer: 'Emerald Isle Casino ® - ¡Disfruta de tus beneficios premium!'
    });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`membership_renew_${membership.membership_type}`)
        .setLabel('🔄 Renovar')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`membership_cancel_${membership.membership_type}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('membership_upgrade')
        .setLabel('⬆️ Mejorar')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [embed], components: [buttons] });
  }
};
