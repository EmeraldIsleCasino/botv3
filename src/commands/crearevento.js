const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const sports = require('../database/sports');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const SPORTS = {
  futbol: { emoji: '⚽', name: 'Futbol' },
  basket: { emoji: '🏀', name: 'Basquetbol' },
  beisbol: { emoji: '⚾', name: 'Beisbol' },
  nascar: { emoji: '🏎️', name: 'NASCAR' },
  boxeo: { emoji: '🥊', name: 'Boxeo' }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crearevento')
    .setDescription('Crea un nuevo evento deportivo para apuestas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('deporte')
        .setDescription('Tipo de deporte')
        .setRequired(true)
        .addChoices(
          { name: '⚽ Futbol', value: 'futbol' },
          { name: '🏀 Basquetbol', value: 'basket' },
          { name: '⚾ Beisbol', value: 'beisbol' },
          { name: '🏎️ NASCAR', value: 'nascar' },
          { name: '🥊 Boxeo', value: 'boxeo' }
        ))
    .addStringOption(option =>
      option.setName('titulo')
        .setDescription('Título del evento')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('equipo1')
        .setDescription('Nombre del equipo/contrincante 1')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('cuota1')
        .setDescription('Cuota del equipo 1 (ej: 1.5)')
        .setRequired(true)
        .setMinValue(1.01))
    .addStringOption(option =>
      option.setName('equipo2')
        .setDescription('Nombre del equipo/contrincante 2')
        .setRequired(true))
    .addNumberOption(option =>
      option.setName('cuota2')
        .setDescription('Cuota del equipo 2 (ej: 2.5)')
        .setRequired(true)
        .setMinValue(1.01))
    .addNumberOption(option =>
      option.setName('cuotaempate')
        .setDescription('Cuota de empate (ej: 3.0, opcional)')
        .setMinValue(1.01)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const sport = interaction.options.getString('deporte');
    const sportInfo = SPORTS[sport];
    const title = interaction.options.getString('titulo');
    const team1Name = interaction.options.getString('equipo1');
    const team1Odds = interaction.options.getNumber('cuota1');
    const team2Name = interaction.options.getString('equipo2');
    const team2Odds = interaction.options.getNumber('cuota2');
    const drawOdds = interaction.options.getNumber('cuotaempate') || null;
    
    // Crear evento PRIMERO para obtener el ID
    const eventId = sports.createEvent({
      channelId: interaction.channel.id,
      messageId: '0',
      title,
      sport,
      team1Name,
      team1Odds,
      team2Name,
      team2Odds,
      drawOdds
    });
    
    let description = `${sportInfo.emoji} **${title}**\n\n`;
    description += `🔵 **${team1Name}** - Cuota: \`${team1Odds.toFixed(2)}\`\n`;
    description += `🔴 **${team2Name}** - Cuota: \`${team2Odds.toFixed(2)}\`\n`;
    if (drawOdds) {
      description += `⚪ **Empate** - Cuota: \`${drawOdds.toFixed(2)}\`\n`;
    }
    description += `\n*Haz clic en un botón para apostar*`;
    
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`sports_bet_team1_${eventId}`)
        .setLabel(`${team1Name}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔵'),
      new ButtonBuilder()
        .setCustomId(`sports_bet_team2_${eventId}`)
        .setLabel(`${team2Name}`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔴')
    ];
    
    if (drawOdds) {
      buttons.push(
        new ButtonBuilder()
          .setCustomId(`sports_bet_draw_${eventId}`)
          .setLabel('Empate')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚪')
      );
    }
    
    const row = new ActionRowBuilder().addComponents(buttons);
    const message = await interaction.channel.send({ embeds: [createEmbed({
      title: `${config.CASINO_NAME} - ${sportInfo.emoji} APUESTAS DEPORTIVAS`,
      description,
      fields: [
        { name: '📊 Estado', value: '🟢 Apuestas Abiertas', inline: true },
        { name: '💰 Apuestas', value: '0', inline: true }
      ],
      footer: 'Emerald Isle Casino ® - ¡Apuesta con responsabilidad!'
    })], components: [row] });
    
    // Actualizar el message_id en la BD
    sports.updateEventMessageId(eventId, message.id);
    
    // Actualizar mesa permanente si existe
    const boardMsg = sports.getEventsBoardMessage(interaction.channel.id);
    if (boardMsg) {
      try {
        const boardChannel = interaction.channel;
        const boardMessage = await boardChannel.messages.fetch(boardMsg.message_id);
        
        const SPORTS_FULL = {
          futbol: '⚽',
          basket: '🏀',
          beisbol: '⚾',
          nascar: '🏎️',
          boxeo: '🥊'
        };
        
        const allEvents = sports.getChannelActiveEvents(interaction.channel.id).slice(0, 5);
        let description = '🍀 **═══ EVENTOS DISPONIBLES ═══** 🍀\n\n';
        allEvents.forEach((e) => {
          const emoji = SPORTS_FULL[e.sport] || '🎯';
          const status = e.status === 'open' ? '🟢 Abierto' : '🔴 Cerrado';
          description += `${emoji} **${e.title}**\n`;
          description += `🥋 **${e.team1_name} vs ${e.team2_name}**\n`;
          description += `${status}\n\n`;
        });
        
        const buttons = allEvents.map((e) => 
          new ButtonBuilder()
            .setCustomId(`event_select_${e.id}`)
            .setLabel(`${e.team1_name} vs ${e.team2_name} (ID: ${e.id})`.substring(0, 80))
            .setStyle(ButtonStyle.Primary)
        );
        
        const rows = [];
        for (let i = 0; i < buttons.length; i += 5) {
          rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
        }
        
        await boardMessage.edit({
          embeds: [createEmbed({
            title: `🍀 ${config.CASINO_NAME} - APUESTAS DEPORTIVAS 🍀`,
            description,
            color: 0x50C878,
            footer: `Total: ${allEvents.length} evento(s) | Mesa Permanente`
          })],
          components: rows.length > 0 ? rows : []
        });
      } catch (e) {
        console.log('No se pudo actualizar mesa permanente:', e.message);
      }
    }
    
    await interaction.editReply({ 
      embeds: [createEmbed({ 
        title: `${sportInfo.emoji} EVENTO CREADO`,
        description: `✅ **ID del Evento: \`${eventId}\`**\n\n📝 Detalles:\n• Título: ${title}\n• ${team1Name} vs ${team2Name}`,
        fields: [
          { name: 'Próximos Pasos', value: `1. Los usuarios apuestan usando los botones\n2. Usa: \`/cerrarevento id:${eventId}\` para cerrar apuestas\n3. Usa: \`/finalizarevento id:${eventId} ganador:equipo1\` para finalizar` }
        ],
        color: 0x00FF00
      })] 
    });
  }
};
