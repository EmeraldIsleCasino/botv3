const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');
const { getDailyStats, getTopStreaks } = require('../database/dailyRewards');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('estadisticasdiarias')
    .setDescription('Ver estadísticas globales de recompensas diarias (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const stats = getDailyStats();
      const topStreaks = getTopStreaks(10);

      if (!stats) {
        return interaction.editReply({
          embeds: [createEmbed({
            title: '❌ Error',
            description: 'Error al cargar estadísticas de recompensas diarias.',
            color: 0xe74c3c
          })]
        });
      }

      const topStreaksText = topStreaks.length > 0
        ? topStreaks.map((user, index) =>
            `${index + 1}. <@${user.user_id}> - **${user.current_streak}** días (${user.longest_streak} máx)`
          ).join('\n')
        : 'No hay datos disponibles.';

      const embed = createEmbed({
        title: `📊 ${config.CASINO_NAME} - Estadísticas de Recompensas Diarias`,
        fields: [
          {
            name: '📈 ACTIVIDAD DE HOY',
            value: `• **Reclamaciones:** ${stats.today.claims}\n• **Total pagado:** ${config.CURRENCY_SYMBOL} ${stats.today.totalAmount.toLocaleString()}`,
            inline: true
          },
          {
            name: '📉 ACTIVIDAD DE AYER',
            value: `• **Reclamaciones:** ${stats.yesterday.claims}\n• **Total pagado:** ${config.CURRENCY_SYMBOL} ${stats.yesterday.totalAmount.toLocaleString()}`,
            inline: true
          },
          {
            name: '👥 USUARIOS ACTIVOS',
            value: `• **Total:** ${stats.activeUsers.count}\n• **Racha promedio:** ${stats.activeUsers.avgStreak} días\n• **Mejor racha:** ${stats.activeUsers.maxStreak} días`,
            inline: true
          },
          {
            name: '🏆 TOP RACHA ACTUAL',
            value: topStreaksText,
            inline: false
          }
        ],
        color: 0x3498db,
        footer: 'Emerald Isle Casino ® - Estadísticas Diarias'
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[DailyRewards] Error in stats command:', error);
      await interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Error',
          description: 'Error al cargar estadísticas. Revisa los logs del bot.',
          color: 0xe74c3c
        })]
      });
    }
  }
};



