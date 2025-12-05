const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const pokerGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pokermesa')
    .setDescription('Crear mesa de poker única')
    .setDefaultMemberPermissions(0),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const guildId = interaction.guildId;
    
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🃏 POKER 🍀`,
      description: `🍀 **═══ MESA DE POKER ═══** 🍀

**Apuestas:** $100 - $5000
**Juego:** Texas Hold'em vs Banca
**Payout:** 2:1 en victorias

*Juego privado e independiente para cada jugador*

═══════════════════════

Entra a la mesa.`,
      color: 0x50C878,
      footer: '🍀 Emerald Isle Casino ®'
    });

    const btn = new ButtonBuilder()
      .setCustomId('pk_play')
      .setLabel('🃏 JUGAR POKER')
      .setStyle(ButtonStyle.Primary);

    const msg = await interaction.channel.send({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(btn)] 
    });

    pokerGames.set(guildId, {
      messageId: msg.id,
      channelId: msg.channelId,
      playerSessions: new Map()
    });

    await interaction.editReply({ content: '✅ Mesa de poker permanente creada. Los jugadores pueden jugar por separado.' });
  },

  getPokerMeta: () => pokerGames,
  storePokerGame: (guildId, data) => pokerGames.set(guildId, data)
};
