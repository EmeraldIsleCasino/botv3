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
    .setName('eventosmesa')
    .setDescription('Crea una mesa permanente de eventos deportivos que se actualiza automáticamente')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const events = sports.getChannelActiveEvents(interaction.channel.id).slice(0, 5);
    
    let description = '🍀 **═══ EVENTOS DISPONIBLES ═══** 🍀\n\n';
    if (events.length === 0) {
      description += '*No hay eventos activos. El administrador puede crear nuevos con `/crearevento`*';
    } else {
      events.forEach((e) => {
        const emoji = SPORTS[e.sport] || '🎯';
        const status = e.status === 'open' ? '🟢 Abierto' : '🔴 Cerrado';
        description += `${emoji} **${e.title}**\n`;
        description += `🥋 **${e.team1_name} vs ${e.team2_name}**\n`;
        description += `${status}\n\n`;
      });
    }
    
    const buttons = events.length > 0 ? events.map((e) => 
      new ButtonBuilder()
        .setCustomId(`event_select_${e.id}`)
        .setLabel(`${e.team1_name} vs ${e.team2_name} (ID: ${e.id})`.substring(0, 80))
        .setStyle(ButtonStyle.Primary)
    ) : [
      new ButtonBuilder()
        .setCustomId('no_events')
        .setLabel('Sin eventos')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    ];
    
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    
    const message = await interaction.channel.send({
      embeds: [createEmbed({
        title: `🍀 ${config.CASINO_NAME} - APUESTAS DEPORTIVAS 🍀`,
        description,
        color: 0x50C878,
        footer: `Total: ${events.length} evento(s) | Mesa Permanente`
      })],
      components: rows.length > 0 ? rows : []
    });
    
    sports.setEventsBoardMessage(interaction.channel.id, message.id);
    
    await interaction.editReply({ 
      embeds: [createEmbed({ 
        title: '✅ MESA PERMANENTE CREADA',
        description: `Se ha creado la mesa permanente de eventos en este canal.\n\nLa mesa se actualizará automáticamente cada vez que se cree un nuevo evento con \`/crearevento\`.`,
        color: 0x00FF00
      })] 
    });
  }
};
