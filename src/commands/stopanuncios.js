const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stopanuncios')
    .setDescription('Detiene el sistema de anuncios (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    // Este comando es placeholder - el verdadero control se hace en startanuncios
    await interaction.editReply({
      embeds: [createEmbed({
        title: '✅ Sistema preparado',
        description: 'Para detener anuncios específicos, elimina el mensaje del canal o usa comandos de Discord.',
        color: 0x00FF00
      })]
    });
  }
};
