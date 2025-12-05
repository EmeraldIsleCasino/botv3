const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const ANUNCIOS = [
  {
    titulo: '🍀 ¡BIENVENIDO A EMERALD ISLE CASINO! 🍀',
    descripcion: '✨ **BLACKJACK • RULETA • POKER • SLOTS • INSIDE TRACK** ✨\n\n🎰 Juegos premium con probabilidades verificadas\n💰 Sistemas justos y premios reales\n🏆 La mejor experiencia de casino\n\n**¡Inicia tu aventura ahora!**'
  },
  {
    titulo: '🃏 BLACKJACK - VENCE LA BANCA 🃏',
    descripcion: '⚡ **Mesa permanente disponible**\n\n🎯 Probabilidades del 45% para ti\n💎 Estrategia y suerte se unen\n🏅 Ganancias hasta 1.5x tu apuesta\n\n**¡Juega con confianza!**'
  },
  {
    titulo: '🎡 RULETA - GIRA Y GANA 🎡',
    descripcion: '⚡ **Mesa permanente disponible**\n\n🎯 44% de probabilidad en cada giro\n💎 Apuestas en colores, números y paridades\n🏅 Premios hasta 36x tu apuesta\n\n**¡La rueda te espera!**'
  },
  {
    titulo: '♠️ POKER - JUEGO DE ESTRATEGIA ♠️',
    descripcion: '⚡ **Mesa permanente disponible**\n\n🎯 Texas Hold\'em contra la banca\n💎 Rake justo del 5% máximo\n🏅 Comparación de manos genuina\n\n**¡Muestra tu talento!**'
  },
  {
    titulo: '🎰 SLOTS - SPIN Y JACKPOT 🎰',
    descripcion: '⚡ **7 temas diferentes**\n\n🎯 RTP 85-90% de retorno\n💎 Multiplicadores y combos especiales\n🏅 Jackpots progresivos\n\n**¡Prueba tu fortuna!**'
  },
  {
    titulo: '🐴 INSIDE TRACK - CARRERAS 🐴',
    descripcion: '⚡ **Carreras de caballos en vivo**\n\n🎯 Elige tu caballo favorito\n💎 Cuotas dinámicas y emocionantes\n🏅 Grandes premios esperan\n\n**¡La carrera está a punto!**'
  },
  {
    titulo: '💰 GANANCIAS GARANTIZADAS 💰',
    descripcion: '✨ **Retira tus premios sin límites**\n\n🍀 Todos los juegos tienen RNG verificado\n🎯 Probabilidades públicas y justas\n💎 Sistema de economía transparente\n\n**¡Tus ganancias, tus reglas!**'
  },
  {
    titulo: '🏆 EMERALD ISLE - TU CASINO 🏆',
    descripcion: '✨ **Experiencia premium completa**\n\n🍀 Blackjack, Ruleta, Poker, Slots, Inside Track\n🎯 Mesas permanentes y disponibles\n💎 Comunidad de jugadores premium\n\n**¡Únete ahora y comienza a ganar!**'
  }
];

let activeAnouncements = new Map();

async function updateAnouncement(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    const anuncio = ANUNCIOS[Math.floor(Math.random() * ANUNCIOS.length)];
    
    const supportChannelLink = 'https://discord.com/channels/1276688551743983637/1285407464971436127';
    
    const embed = createEmbed({
      title: anuncio.titulo,
      description: anuncio.descripcion,
      fields: [
        { name: '💵 RECARGAS Y SOPORTE', value: `[🔗 Ir al canal de soporte](${supportChannelLink})`, inline: false },
        { name: '✅ VERIFICADO', value: '✓ Probabilidades justas\n✓ Sistema RNG certificado\n✓ Pagos sin límite', inline: true }
      ],
      footer: 'Emerald Isle Casino ® - Actualizado cada 10 minutos | ¡Juega responsablemente!'
    });
    
    const button = new ButtonBuilder()
      .setLabel('⚡ Ir a Apostar')
      .setStyle(ButtonStyle.Link)
      .setURL(supportChannelLink);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    await message.edit({ embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Error actualizando anuncio:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('startanuncios')
    .setDescription('Inicia sistema de anuncios que se actualiza cada 10 minutos (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal donde enviar los anuncios')
        .setRequired(true)),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const channel = interaction.options.getChannel('canal');
    
    if (!channel.isTextBased()) {
      return interaction.editReply({ 
        embeds: [createEmbed({ 
          title: '❌ Error', 
          description: 'El canal debe ser de texto', 
          color: 0xFF6B6B 
        })] 
      });
    }
    
    // Crear anuncio inicial
    const anuncio = ANUNCIOS[Math.floor(Math.random() * ANUNCIOS.length)];
    const supportChannelLink = 'https://discord.com/channels/1276688551743983637/1285407464971436127';
    
    const embed = createEmbed({
      title: anuncio.titulo,
      description: anuncio.descripcion,
      fields: [
        { name: '💵 RECARGAS Y SOPORTE', value: `[🔗 Ir al canal de soporte](${supportChannelLink})`, inline: false },
        { name: '✅ VERIFICADO', value: '✓ Probabilidades justas\n✓ Sistema RNG certificado\n✓ Pagos sin límite', inline: true }
      ],
      footer: 'Emerald Isle Casino ® - Actualizado cada 10 minutos | ¡Juega responsablemente!'
    });
    
    const button = new ButtonBuilder()
      .setLabel('⚡ Ir a Apostar')
      .setStyle(ButtonStyle.Link)
      .setURL(supportChannelLink);
    
    const row = new ActionRowBuilder().addComponents(button);
    
    const message = await channel.send({ embeds: [embed], components: [row] });
    
    // Guardar intervalo
    const key = `${channel.id}_${message.id}`;
    
    if (activeAnouncements.has(key)) {
      clearInterval(activeAnouncements.get(key).interval);
    }
    
    // Actualizar cada 10 minutos
    const interval = setInterval(() => {
      updateAnouncement(channel, message.id);
    }, 10 * 60 * 1000); // 10 minutos
    
    activeAnouncements.set(key, { interval, channelId: channel.id, messageId: message.id });
    
    await interaction.editReply({
      embeds: [createEmbed({
        title: '✅ SISTEMA DE ANUNCIOS ACTIVADO',
        description: `🍀 Los anuncios se enviarán en ${channel}\n\n📅 Se actualizarán automáticamente cada 10 minutos\n\n💬 Incluye botón para ir al canal de soporte`,
        color: 0x00FF00
      })]
    });
  }
};
