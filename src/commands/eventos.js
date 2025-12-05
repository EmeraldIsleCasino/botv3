const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sports = require('../database/sports');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const SPORTS = {
  futbol: '⚽',
  basket: '🏀',
  beisbol: '⚾',
  nascar: '🏎️',
  boxeo: '🥊'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventos')
    .setDescription('Lista todos los eventos activos para apostar')
    .setDefaultMemberPermissions(0),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const events = sports.getChannelActiveEvents(interaction.channel.id).slice(0, 5);
    
    if (events.length === 0) {
      return interaction.editReply({ embeds: [errorEmbed('No hay eventos activos.')] });
    }
    
    let description = '🍀 **═══ EVENTOS DISPONIBLES ═══** 🍀\n\n';
    events.forEach((e, i) => {
      const emoji = SPORTS[e.sport] || '🎯';
      const status = e.status === 'open' ? '🟢 Abierto' : '🔴 Cerrado';
      description += `**Evento ${i + 1}** ${emoji}\n`;
      description += `${emoji} **${e.title}**\n`;
      description += `${e.team1_name} vs ${e.team2_name} | ${status}\n\n`;
    });
    
    const buttons = events.map((e) => 
      new ButtonBuilder()
        .setCustomId(`event_select_${e.id}`)
        .setLabel(`${e.title} (ID: ${e.id})`.substring(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
    
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    
    await interaction.editReply({
      embeds: [createEmbed({
        title: `🍀 ${config.CASINO_NAME} - APUESTAS DEPORTIVAS 🍀`,
        description,
        color: 0x50C878,
        footer: `Total: ${events.length} evento(s)`
      })],
      components: rows
    });
  }
};
