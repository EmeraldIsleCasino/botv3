const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpiar')
    .setDescription('Borrar mensajes del canal (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(option =>
      option.setName('cantidad')
        .setDescription('Cantidad de mensajes a borrar (1-100)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const amount = interaction.options.getInteger('cantidad');
    
    try {
      // Obtener mensajes
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      
      // Borrar mensajes (bulk delete solo funciona con mensajes menores a 2 semanas)
      const deleted = await interaction.channel.bulkDelete(messages, true);
      
      const embed = successEmbed(
        `✅ Se eliminaron ${deleted.size} mensajes del canal`,
        [
          { name: '📝 Cantidad', value: `${deleted.size} mensajes`, inline: true },
          { name: '📍 Canal', value: `<#${interaction.channel.id}>`, inline: true },
          { name: '👤 Administrador', value: interaction.user.username, inline: true }
        ]
      );
      
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error borrando mensajes:', error);
      const errorResponse = error.message.includes('bulk') 
        ? 'Los mensajes pueden ser muy antiguos (mayores a 2 semanas) para borrar en lote'
        : 'Ocurrió un error al borrar los mensajes';
      
      await interaction.editReply({ embeds: [errorEmbed(`❌ ${errorResponse}`)] });
    }
  }
};
