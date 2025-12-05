const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { saveAllDatabases } = require('../database');
const { successEmbed, errorEmbed } = require('../utils/embedBuilder');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guardar')
    .setDescription('Guarda manualmente todas las bases de datos')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const success = saveAllDatabases();
    
    if (success) {
      await interaction.editReply({ embeds: [successEmbed('Todas las bases de datos han sido guardadas correctamente.')] });
    } else {
      await interaction.editReply({ embeds: [errorEmbed('Error al guardar las bases de datos.')] });
    }
  }
};
