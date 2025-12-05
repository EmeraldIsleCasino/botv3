const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const sports = require('../database/sports');
const economy = require('../database/economy');
const { createEmbed, errorEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eliminarevento')
    .setDescription('Elimina el evento activo y devuelve las apuestas')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const event = sports.getActiveEvent(interaction.channel.id);
    if (!event) {
      return interaction.editReply({ embeds: [errorEmbed('No hay ningún evento activo en este canal.')] });
    }
    
    const bets = sports.getEventBets(event.id);
    
    for (const bet of bets) {
      economy.addWinnings(bet.user_id, bet.amount);
    }
    
    try {
      const message = await interaction.channel.messages.fetch(event.message_id);
      await message.delete();
    } catch {}
    
    sports.deleteEvent(event.id);
    
    // Actualizar mesa permanente
    const boardMsg = sports.getEventsBoardMessage(interaction.channel.id);
    if (boardMsg) {
      try {
        const boardChannel = interaction.channel;
        const boardMessage = await boardChannel.messages.fetch(boardMsg.message_id);
        
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const SPORTS_FULL = {
          futbol: '⚽',
          basket: '🏀',
          beisbol: '⚾',
          nascar: '🏎️',
          boxeo: '🥊'
        };
        
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
        description: `✅ Evento eliminado. Se han devuelto ${config.CURRENCY_SYMBOL} ${bets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()} a ${bets.length} usuario(s).` 
      })] 
    });
  }
};
