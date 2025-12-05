const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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
    .setName('cerrarevento')
    .setDescription('Cierra las apuestas de un evento')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID del evento (míralo en /eventos o en el mensaje de creación)')
        .setRequired(true)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const eventId = interaction.options.getInteger('id');
    const event = sports.getEventById(eventId);
    
    if (!event) {
      return interaction.editReply({ embeds: [errorEmbed(`❌ Evento ID ${eventId} no encontrado.\n\nUsa /eventos para ver los IDs disponibles.`)] });
    }
    
    if (event.channel_id !== interaction.channel.id) {
      return interaction.editReply({ embeds: [errorEmbed('❌ Este evento no pertenece a este canal.')] });
    }
    
    if (event.status !== 'open') {
      return interaction.editReply({ embeds: [errorEmbed(`❌ Este evento ya está ${event.status === 'closed' ? 'cerrado' : 'finalizado'}.`)] });
    }
    
    sports.closeEvent(eventId);
    
    const bets = sports.getEventBets(eventId);
    const totalBets = bets.reduce((sum, b) => sum + b.amount, 0);
    
    const emoji = SPORTS[event.sport] || '🎯';
    let description = `${emoji} **${event.title}** (ID: ${eventId})\n\n`;
    description += `🔵 **${event.team1_name}** (${event.team1_odds.toFixed(2)})\n`;
    description += `🔴 **${event.team2_name}** (${event.team2_odds.toFixed(2)})\n`;
    if (event.draw_odds) {
      description += `⚪ **Empate** (${event.draw_odds.toFixed(2)})\n`;
    }
    description += `\n**Esperando resultado...**`;
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - ${emoji} EVENTO CERRADO`,
      description,
      fields: [
        { name: 'Apuestas Recibidas', value: `${bets.length}` },
        { name: 'Total Apostado', value: `${config.CURRENCY_SYMBOL} ${totalBets.toLocaleString()}` }
      ],
      color: 0xFF6B6B
    });
    
    try {
      const msg = await interaction.channel.messages.fetch(event.message_id);
      await msg.edit({ embeds: [embed], components: [] });
    } catch {}
    
    // Actualizar mesa permanente
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
        
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const allEvents = sports.getChannelActiveEvents(interaction.channel.id).slice(0, 5);
        let boardDescription = '🍀 **═══ EVENTOS DISPONIBLES ═══** 🍀\n\n';
        if (allEvents.length === 0) {
          boardDescription += '*No hay eventos activos*';
        } else {
          allEvents.forEach((e) => {
            const eEmoji = SPORTS_FULL[e.sport] || '🎯';
            const status = e.status === 'open' ? '🟢 Abierto' : '🔴 Cerrado';
            boardDescription += `${eEmoji} **${e.title}**\n`;
            boardDescription += `🥋 **${e.team1_name} vs ${e.team2_name}**\n`;
            boardDescription += `${status}\n\n`;
          });
        }
        
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
            description: boardDescription,
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
        description: `✅ Evento ${eventId} cerrado.\n\n📌 Ahora usa:\n\`/finalizarevento id:${eventId} ganador:equipo1\`\n\n(Reemplaza "equipo1" con "equipo2" o "draw" según corresponda)`
      })] 
    });
  }
};
