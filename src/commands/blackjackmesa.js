const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const blackjackGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjackmesa')
    .setDescription('Crear mesa de Blackjack única')
    .setDefaultMemberPermissions(0),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const guildId = interaction.guildId;
    
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🂠 BLACKJACK 🍀`,
      description: `🍀 **═══ MESA DE BLACKJACK ═══** 🍀

**Apuestas:** $100 - $5000
**Pago:** 1.5x en victorias

*Juego privado e independiente para cada jugador*

═══════════════════════

Entra a la mesa.`,
      color: 0x50C878,
      footer: '🍀 Emerald Isle Casino ®'
    });

    const btn = new ButtonBuilder()
      .setCustomId('bj_play')
      .setLabel('🂠 JUGAR BLACKJACK')
      .setStyle(ButtonStyle.Success);

    const msg = await interaction.channel.send({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(btn)] 
    });

    blackjackGames.set(guildId, {
      messageId: msg.id,
      channelId: msg.channelId,
      playerSessions: new Map()
    });

    await interaction.editReply({ content: '✅ Mesa de blackjack permanente creada. Los jugadores pueden jugar por separado.' });
  },

  getBlackjackMeta: () => blackjackGames,
  storeBlackjackGame: (guildId, data) => blackjackGames.set(guildId, data)
};
