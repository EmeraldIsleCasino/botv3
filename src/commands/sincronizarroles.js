const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const { syncMembershipRoles } = require('../utils/discordRoles');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sincronizarroles')
    .setDescription('Sincroniza roles de membresía para todos los usuarios (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });

    try {
      const result = await syncMembershipRoles(interaction.guild);

      let description;
    let color;

    if (result.errors === 0) {
      description = `**Sincronización completada exitosamente**\n\n━━━━━━━━━━━━━━━━━\n\n📊 **Resultados:**\n• ✅ Roles asignados: ${result.synced}\n• ❌ Errores: ${result.errors}\n\n━━━━━━━━━━━━━━━━━\n\n💡 **Nota:** Los roles de membresía se sincronizan automáticamente con cada compra/renovación/cancelación.`;
      color = 0x00FF00;
    } else {
      description = `**Sincronización completada con advertencias**\n\n━━━━━━━━━━━━━━━━━\n\n📊 **Resultados:**\n• ✅ Roles asignados: ${result.synced}\n• ❌ Errores: ${result.errors}\n\n━━━━━━━━━━━━━━━━━\n\n⚠️ **Nota sobre errores:**\nEn servidores grandes (>1000 miembros), es normal que la sincronización de roles inactivos falle por timeout de Discord. Los roles activos se sincronizaron correctamente.\n\n💡 **Nota:** Los roles de membresía se sincronizan automáticamente con cada compra/renovación/cancelación.`;
      color = 0xFFA500;
    }

    const embed = createEmbed({
      title: `✅ ${config.CASINO_NAME} - Sincronización de Roles`,
      description: description,
      color: color,
      footer: 'Emerald Isle Casino ® - Sistema de Roles Premium'
    });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[SyncRoles] Error:', error);
      await interaction.editReply({
        embeds: [errorEmbed('Error al sincronizar roles. Revisa los logs del bot.')]
      });
    }
  }
};
