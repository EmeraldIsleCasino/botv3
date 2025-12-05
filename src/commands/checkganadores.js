const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const sports = require('../database/sports');
const { sportsDb } = require('../database/index');
const economy = require('../database/economy');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkganadores')
    .setDescription('Verifica quiénes ganaron las apuestas deportivas finalizadas (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(option =>
      option.setName('deporte')
        .setDescription('Deporte a revisar (boxeo, futbol, basket, beisbol, nascar) o "todos"')
        .setRequired(false)
        .addChoices(
          { name: 'Boxeo', value: 'boxeo' },
          { name: 'Fútbol', value: 'futbol' },
          { name: 'Basketball', value: 'basket' },
          { name: 'Béisbol', value: 'beisbol' },
          { name: 'NASCAR', value: 'nascar' },
          { name: 'Todos', value: 'todos' }
        )),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const deporte = interaction.options.getString('deporte') || 'todos';
    
    // Buscar eventos globalmente (sin filtro de canal) ya que puede haber eventos de cualquier canal
    let allEvents = sportsDb.prepare('SELECT * FROM events ORDER BY id DESC').all();
    let events = allEvents;
    
    if (deporte !== 'todos') {
      events = events.filter(e => e.sport === deporte);
    }
    
    if (events.length === 0) {
      return interaction.editReply({
        embeds: [createEmbed({
          title: '❌ Sin Eventos',
          description: `❌ **NO HAY EVENTOS GUARDADOS EN LA BASE DE DATOS**\n\n💡 Usa \`/crearevento\` para crear nuevos eventos.\n\nEsperando eventos ${deporte !== 'todos' ? `de ${deporte}` : ''}...`,
          color: 0xFF6B6B
        })]
      });
    }
    
    const SPORTS = {
      futbol: '⚽',
      basket: '🏀',
      beisbol: '⚾',
      nascar: '🏎️',
      boxeo: '🥊'
    };
    
    let fields = [];
    let totalWinners = 0;
    let totalLosers = 0;
    let totalPayout = 0;
    
    for (const event of events) {
      const emoji = SPORTS[event.sport] || '🎯';
      const bets = sports.getEventBets(event.id);
      
      let description = `${emoji} **${event.title}**\n`;
      description += `🥊 ${event.team1_name} vs ${event.team2_name}\n`;
      description += `📊 Estado: \`${event.status}\`\n\n`;
      
      if (event.status !== 'open') {
        description += `**🏆 Ganador:** ${event.winner === 'team1' ? event.team1_name : event.winner === 'team2' ? event.team2_name : event.winner ? 'Empate' : 'No definido'}\n\n`;
        
        const winningBets = bets.filter(b => b.team === event.winner);
        const losingBets = bets.filter(b => b.team !== event.winner);
        
        totalWinners += winningBets.length;
        totalLosers += losingBets.length;
        totalPayout += winningBets.reduce((sum, b) => sum + b.potential_win, 0);
        
        description += `✅ **Ganadores (${winningBets.length}):**\n`;
        if (winningBets.length > 0) {
          for (const bet of winningBets.slice(0, 5)) {
            try {
              const user = await interaction.client.users.fetch(bet.user_id);
              description += `• ${user.tag}: +${config.CURRENCY_SYMBOL} ${bet.potential_win.toLocaleString()}\n`;
            } catch {
              description += `• ${bet.user_id}: +${config.CURRENCY_SYMBOL} ${bet.potential_win.toLocaleString()}\n`;
            }
          }
          if (winningBets.length > 5) description += `... y ${winningBets.length - 5} más\n`;
        } else {
          description += `*Nadie ganó*\n`;
        }
        
        description += `\n❌ **Perdedores (${losingBets.length}):**\n`;
        if (losingBets.length > 0) {
          for (const bet of losingBets.slice(0, 5)) {
            try {
              const user = await interaction.client.users.fetch(bet.user_id);
              description += `• ${user.tag}: -${config.CURRENCY_SYMBOL} ${bet.amount.toLocaleString()}\n`;
            } catch {
              description += `• ${bet.user_id}: -${config.CURRENCY_SYMBOL} ${bet.amount.toLocaleString()}\n`;
            }
          }
          if (losingBets.length > 5) description += `... y ${losingBets.length - 5} más\n`;
        }
      } else {
        description += `**📝 Apuestas:** ${bets.length}\n`;
        description += `**💰 Total Apostado:** ${config.CURRENCY_SYMBOL} ${bets.reduce((sum, b) => sum + b.amount, 0).toLocaleString()}\n`;
        description += `\n*Las apuestas están abiertas. Ciérralo con /cerrarevento*`;
      }
      
      fields.push({
        name: `ID ${event.id}`,
        value: description,
        inline: false
      });
    }
    
    const embed = createEmbed({
      title: `${config.CASINO_NAME} - 📊 VERIFICACIÓN DE GANADORES`,
      description: `Total de eventos finalizados: **${events.length}**`,
      fields,
      footer: `Ganadores: ${totalWinners} | Perdedores: ${totalLosers} | Total pagado: ${config.CURRENCY_SYMBOL} ${totalPayout.toLocaleString()}`
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
