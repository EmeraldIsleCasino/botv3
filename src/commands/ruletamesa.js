const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

// Store permanent roulette message per guild
const rouletteGames = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ruletamesa')
    .setDescription('Crear mesa de ruleta única')
    .setDefaultMemberPermissions(0),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const guildId = interaction.guildId;
    
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 🎡 RULETA 🍀`,
      description: `🍀 **═══ MESA DE RULETA ═══** 🍀

**Apuestas:** $100 - $5000
**Tipos:** Rojo, Negro, Par, Impar, Números

*Juego privado e independiente para cada jugador*

═══════════════════════

Entra a la mesa.`,
      color: 0xE91E63,
      footer: '🍀 Emerald Isle Casino ®'
    });

    const btn = new ButtonBuilder()
      .setCustomId('rl_play')
      .setLabel('🎡 JUGAR RULETA')
      .setStyle(ButtonStyle.Danger);

    const msg = await interaction.channel.send({ 
      embeds: [embed], 
      components: [new ActionRowBuilder().addComponents(btn)] 
    });

    // Store message reference for this guild
    rouletteGames.set(guildId, {
      messageId: msg.id,
      channelId: msg.channelId,
      playerSessions: new Map()
    });

    await interaction.editReply({ content: '✅ Mesa de ruleta permanente creada. Los jugadores pueden jugar por separado.' });
  },

  // Export for use in interactionCreate
  getRouletteMeta: () => rouletteGames,
  storeRouletteGame: (guildId, data) => rouletteGames.set(guildId, data)
};
