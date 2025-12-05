const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minijuegos')
    .setDescription('Abre el menú de minijuegos del casino'),

  async execute(interaction) {
    const games = [
      { id: 'mines', emoji: '💣', name: 'Minas', desc: 'Revela celdas y evita las minas' },
      { id: 'jackpot', emoji: '💰', name: 'Jackpot Rooms', desc: 'Salas con premios acumulados' },
      { id: 'duel', emoji: '⚔️', name: 'Arena Duel', desc: 'Combate PvP por turnos' },
      { id: 'crash', emoji: '🏎️', name: 'Nahcar Crash', desc: 'Carrera con eventos aleatorios' },
      { id: 'boxing', emoji: '🥊', name: 'Boxing LS', desc: 'Boxeo PvP con stamina' },
      { id: 'penalty', emoji: '⚽', name: 'Penalty Shoot-out', desc: 'Tiros penales a 5 rondas' },
      { id: 'wheel', emoji: '🎡', name: 'Wheel Xtreme', desc: 'Ruleta de 20 sectores' },
      { id: 'heist', emoji: '🔫', name: 'Bank Heist', desc: 'Atraco cooperativo' },
      { id: 'duck', emoji: '🦆', name: 'Duck Race', desc: 'Carrera de patos' },
      { id: 'tower', emoji: '🗼', name: 'Tower', desc: 'Sube pisos y multiplica' }
    ];

    const gameList = games.map(g => `${g.emoji} **${g.name}** - ${g.desc}`).join('\n');

    const embed = createEmbed({
      title: `🎮 Minijuegos del ${config.CASINO_NAME}`,
      description: `¡Selecciona cualquier juego para abrir tu sala privada!\nTus partidas son únicas, persistentes y sin spam en el canal público.\n\n${gameList}`,
      color: 0x50c878,
      footer: 'Emerald Isle Casino ® - ¡Buena suerte!'
    });

    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mg_mines').setLabel('Minas').setEmoji('💣').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mg_jackpot').setLabel('Jackpot').setEmoji('💰').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mg_duel').setLabel('Arena').setEmoji('⚔️').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('mg_crash').setLabel('Crash').setEmoji('🏎️').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mg_boxing').setLabel('Boxing').setEmoji('🥊').setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('mg_penalty').setLabel('Penalty').setEmoji('⚽').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mg_wheel').setLabel('Wheel').setEmoji('🎡').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('mg_heist').setLabel('Heist').setEmoji('🔫').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('mg_duck').setLabel('Ducks').setEmoji('🦆').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('mg_tower').setLabel('Tower').setEmoji('🗼').setStyle(ButtonStyle.Primary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row1, row2]
    });
  }
};
