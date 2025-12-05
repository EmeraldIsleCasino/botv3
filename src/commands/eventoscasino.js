const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

const EVENTOS_CASINO = [
  {
    titulo: '🍀 BIENVENIDO A EMERALD ISLE CASINO 🍀',
    descripcion: '📍 **Ubicación:** /prop 2188\n\n✨ Tu destino de juego premium\n🎰 Blackjack, Ruleta, Poker, Slots\n🐴 Inside Track - Carreras en vivo\n🏆 La mejor experiencia de casino\n\n**¡Visítanos hoy!**',
    imagen: 'https://i.imgur.com/hW5Hm4Y.png'
  },
  {
    titulo: '🎰 GRAN APERTURA - /PROP 2188 🎰',
    descripcion: '📍 **Ubicación:** /prop 2188\n\n🎉 ¡El casino más esperado está aquí!\n💎 Mesas de juego premium\n🍀 Atmósfera de lujo y emoción\n💰 Premios y jackpots sin límite\n\n**Ven a celebrar con nosotros**',
    imagen: 'https://i.imgur.com/fhKlXVX.png'
  },
  {
    titulo: '🃏 BLACKJACK - MESERO EN VIVO 🃏',
    descripcion: '📍 **En Emerald Isle Casino** /prop 2188\n\n⚡ Mesas con dealers profesionales\n🎯 Probabilidades del 45% para ti\n💎 Ambiente elegante y sofisticado\n🏅 Bebidas premium mientras juegas\n\n**¡Vence la banca en persona!**',
    imagen: 'https://i.imgur.com/hW5Hm4Y.png'
  },
  {
    titulo: '🎡 RULETA - NOCHE ESPECIAL 🎡',
    descripcion: '📍 **En Emerald Isle Casino** /prop 2188\n\n⚡ Ruleta en vivo con croupiers\n🎯 44% de probabilidad en cada giro\n💎 Ambiente VIP y exclusivo\n🏅 Eventos especiales cada noche\n\n**¡La suerte te espera!**',
    imagen: 'https://i.imgur.com/fePQgyf.png'
  },
  {
    titulo: '♠️ POKER TOURNAMENT ♠️',
    descripcion: '📍 **Emerald Isle Casino** /prop 2188\n\n⚡ Torneos de Texas Hold\'em\n🎯 Competencia contra verdaderos jugadores\n💎 Premios progresivos y bonus\n🏅 Mesas exclusivas para miembros\n\n**¡Demuestra tu estrategia!**',
    imagen: 'https://i.imgur.com/BhWz6XC.png'
  },
  {
    titulo: '🎰 SLOTS JACKPOT - /PROP 2188 🎰',
    descripcion: '📍 **Ubicación:** /prop 2188\n\n⚡ 7 temas de slots únicos\n🎯 RTP 85-90% de retorno\n💎 Máquinas de última generación\n🏅 Jackpots progresivos en vivo\n\n**¡Prueba suerte en nuestras máquinas!**',
    imagen: 'https://i.imgur.com/fhKlXVX.png'
  },
  {
    titulo: '🐴 INSIDE TRACK - CARRERAS 🐴',
    descripcion: '📍 **Emerald Isle Casino** /prop 2188\n\n⚡ Transmisión en vivo de carreras\n🎯 Apuestas emocionantes y cuotas justas\n💎 Pantallas HD para seguir la acción\n🏅 Área lounge premium\n\n**¡Vive la emoción de las carreras!**',
    imagen: 'https://i.imgur.com/L2vG6mT.png'
  },
  {
    titulo: '💰 VIP LOUNGE ABIERTO 💰',
    descripcion: '📍 **Emerald Isle Casino** /prop 2188\n\n✨ Acceso exclusivo para miembros\n🍀 Servicio personal y Premium\n🎯 Eventos y torneos especiales\n💎 Premios y promociones únicas\n\n**¡Sé parte de nuestra comunidad VIP!**',
    imagen: 'https://i.imgur.com/L2vG6mT.png'
  }
];

let activeEventsCasino = new Map();

async function updateEventoCasino(channel, messageId) {
  try {
    const message = await channel.messages.fetch(messageId);
    const evento = EVENTOS_CASINO[Math.floor(Math.random() * EVENTOS_CASINO.length)];
    
    const embed = createEmbed({
      title: evento.titulo,
      description: evento.descripcion,
      fields: [
        { name: '📍 UBICACIÓN', value: '/prop 2188', inline: true },
        { name: '⏰ HORARIO', value: 'Abierto todos los días', inline: true }
      ],
      footer: 'Emerald Isle Casino ® - Actualizado cada 10 minutos | ¡Visítanos!',
      image: evento.imagen
    });
    
    await message.edit({ embeds: [embed] });
  } catch (error) {
    console.error('Error actualizando evento del casino:', error);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eventoscasino')
    .setDescription('Inicia eventos del casino físico que se actualizan cada 10 minutos (Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(option =>
      option.setName('canal')
        .setDescription('Canal donde enviar los eventos')
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
    
    // Crear evento inicial
    const evento = EVENTOS_CASINO[Math.floor(Math.random() * EVENTOS_CASINO.length)];
    
    const embed = createEmbed({
      title: evento.titulo,
      description: evento.descripcion,
      fields: [
        { name: '📍 UBICACIÓN', value: '/prop 2188', inline: true },
        { name: '⏰ HORARIO', value: 'Abierto todos los días', inline: true }
      ],
      footer: 'Emerald Isle Casino ® - Actualizado cada 10 minutos | ¡Visítanos!',
      image: evento.imagen
    });
    
    const message = await channel.send({ embeds: [embed] });
    
    // Guardar intervalo
    const key = `casino_${channel.id}_${message.id}`;
    
    if (activeEventsCasino.has(key)) {
      clearInterval(activeEventsCasino.get(key).interval);
    }
    
    // Actualizar cada 10 minutos
    const interval = setInterval(() => {
      updateEventoCasino(channel, message.id);
    }, 10 * 60 * 1000); // 10 minutos
    
    activeEventsCasino.set(key, { interval, channelId: channel.id, messageId: message.id });
    
    await interaction.editReply({
      embeds: [createEmbed({
        title: '✅ EVENTOS DEL CASINO ACTIVADOS',
        description: `🍀 Los eventos se enviarán en ${channel}\n\n📍 Ubicación: /prop 2188\n📅 Se actualizarán automáticamente cada 10 minutos\n\n🎰 Todos los juegos: Blackjack, Ruleta, Poker, Slots, Inside Track`,
        color: 0x00FF00
      })]
    });
  }
};
