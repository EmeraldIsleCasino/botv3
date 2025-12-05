const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed } = require('../utils/embedBuilder');
const config = require('../utils/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ayuda')
    .setDescription('Muestra la lista de todos los comandos disponibles')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    
    const commands = {
      '💰 **ECONOMÍA**': [
        '`/balance [@usuario]` - Ver tu saldo o el de otro usuario (admin)',
        '`/recargar @usuario cantidad` - Añadir dinero a un usuario (Admin)',
        '`/quitardinero @usuario cantidad` - Quitar dinero a un usuario (Admin)',
        '`/fondos` - Ver top 15 de balances del servidor (Admin)',
        '`/transacciones @usuario [límite]` - Ver historial de transacciones (Admin)',
        '`/estadisticas` - Ver estadísticas generales del casino (Admin)',
        '`/reseteconomia` - Resetear TODA la economía ⚠️ (Solo dueño)',
        '`/insidefondos` - Ver ganancias del Inside Track (Admin)',
        '`/deportesfondos` - Ver ganancias de apuestas deportivas (Admin)'
      ],
      '🎉 **SORTEOS**': [
        '`/crearsorteo premio` - Crear un nuevo sorteo (Admin)',
        '`/cerrarsorteo` - Cerrar sorteo y seleccionar ganador (Admin)',
        '`/borrarsorteo` - Eliminar sorteo activo (Admin)',
        '`/participantes` - Ver lista de participantes del sorteo activo (Admin)',
        '`/topganadores` - Ver ranking de ganadores (Admin)'
      ],
      '⚽ **APUESTAS DEPORTIVAS**': [
        '`/eventosmesa` - Crear mesa permanente de eventos 🍀 (Admin)',
        '`/eventos` - Ver eventos activos y apostar (Todos)',
        '`/crearevento` - Crear evento deportivo (Admin)',
        '💡 **Actualización:** La mesa se actualiza automáticamente',
        '`/cerrarevento id` - Cerrar apuestas (Admin)',
        '`/finalizarevento id ganador` - Finalizar evento y pagar (Admin)',
        '`/eliminarevento` - Eliminar evento y devolver apuestas (Admin)',
        '`/checkganadores [deporte]` - Ver resultados y pagos de eventos finalizados (Admin)',
        '💡 **Deportes:** ⚽ Futbol, 🏀 Basquetbol, ⚾ Beisbol, 🏎️ NASCAR, 🥊 Boxeo'
      ],
      '🏇 **INSIDE TRACK**': [
        '`/insidetrack` - Iniciar carrera de caballos (Admin)',
        '`/borrarinsidetrack` - Eliminar carrera y devolver apuestas (Admin)'
      ],
      '🂠 **BLACKJACK**': [
        '`/blackjack` - Jugar Blackjack individual (Todos)',
        '`/blackjackmesa` - Crear mesa compartida de Blackjack (Admin)',
        '💡 **Mecánica:** Todos los jugadores usan la misma mesa',
        '💡 **Opciones:** Pedir, Quedarse, Doblar, Dividir',
        '💡 **Apuestas:** $100 - $5000 | Pago: 1.5x en Blackjack, 2x ganadas'
      ],
      '🎡 **RULETA - MESA ÚNICA**': [
        '`/ruletamesa` - Crear mesa compartida de Ruleta (Admin)',
        '💡 **Apuestas:** Rojo/Negro (2:1), Par/Impar (2:1), Números 0-36 (36:1)',
        '💡 **Monto:** $100 - $5000 por apuesta',
        '💡 **Resultado:** Se gira automáticamente después de 2 segundos'
      ],
      '🃏 **POKER - MESA ÚNICA**': [
        '`/pokermesa` - Crear mesa compartida de Poker (Admin)',
        '💡 **Juego:** Texas Hold\'em vs Banca (Draw Poker)',
        '💡 **Mecánica:** Cambia cartas, compara manos vs la banca',
        '💡 **Ventaja casa:** Empates favorecen a la banca',
        '💡 **Apuestas:** $100 - $5000 | Pago: 2x ganadas'
      ],
      '🎰 **JUEGOS DEL CASINO**': [
        '`/blackjack` - Jugar Blackjack (modal de apuesta)',
        '`/ruletamesa` - Jugar Ruleta (modal de apuesta)',
        '`/pokermesa` - Jugar Poker (mesa compartida)',
        '`/slots` - Tragamonedas (7 temas diferentes)',
        '💡 **Sistema de apuestas:** Modales interactivos',
        '💡 **Beneficios VIP:** Límites más altos y bonos'
      ],
      '💎 **MEMBRESÍAS**': [
        '`/membresias publicar` - Publicar mensaje de membresías con botones (Admin)',
        '`/mimembresia` - Ver estado de tu membresía actual (Todos)',
        '`/sincronizarroles` - Sincronizar roles de membresía (Admin)',
        '💡 **Niveles:** 🥈 Silver, 🥇 Gold, 💎 Platinum',
        '💡 **Sistema:** Membresías premium con beneficios exclusivos + roles Discord',
        '💡 **Beneficios:** Bonos, cashback semanal, límites más altos, roles premium'
      ],
      '📢 **ANUNCIOS AUTOMÁTICOS**': [
        '`/startanuncios #canal` - Iniciar anuncios que se actualizan cada 10 min (Admin)',
        '`/stopanuncios` - Detener sistema de anuncios (Admin)',
        '💡 **Contenido:** Promociones de juegos, soporte y verificaciones',
        '💡 **Botones:** Enlaces directos al canal de soporte'
      ],
      '🏛️ **EVENTOS DEL CASINO FÍSICO**': [
        '`/eventoscasino #canal` - Iniciar eventos del casino físico (Admin)',
        '💡 **Ubicación:** /prop 2188 - Abierto todos los días',
        '💡 **Actualización:** Se actualiza automáticamente cada 10 minutos',
        '💡 **Contenido:** Eventos, promociones e imágenes del casino'
      ],
      '🎁 **RECOMPENSAS DIARIAS**': [
        '`/recompensadiaria` - Reclamar recompensa diaria y ver estadísticas',
        '`/estadisticasdiarias` - Ver estadísticas globales de recompensas (Admin)'
      ],
      '🏆 **TORNEOS DE PUNTOS**': [
        '`/torneos crear` - Crear torneo de puntos (Admin)',
        '`/torneos listar` - Ver torneos activos',
        '`/torneos unirse [ID]` - Unirse a torneo (paga cuota)',
        '`/torneos salir [ID]` - Salir y recuperar cuota',
        '`/torneos info [ID]` - Ver ranking y detalles',
        '`/torneos admin` - Gestionar torneos (Admin)',
        '`/torneos estadisticas` - Estadísticas generales',
        '**🎯 Sistema:** Gana puntos jugando - ¡Más victorias = más puntos!'
      ],
      '🔍 **LOGS Y ACTIVIDAD**': [
        '`/logs recientes` - Ver actividad reciente del casino (Admin)',
        '`/logs usuario @usuario` - Ver actividad de un usuario (Admin)',
        '`/logs estadisticas` - Ver estadísticas de actividad (Admin)',
        '`/logs filtrar` - Filtrar logs por categoría y acción (Admin)'
      ],
      '📊 **ADMINISTRACIÓN**': [
        '`/dashboard` - Panel administrativo completo con navegación (Admin)',
        '`/estadisticasdiarias` - Estadísticas de recompensas diarias (Admin)'
      ],
      '⚙️ **UTILIDAD**': [
        '`/guardar` - Guardar todas las bases de datos (Admin)',
        '`/limpiar cantidad` - Borrar últimos N mensajes del canal (Admin)',
        '`/ayuda` - Mostrar este mensaje'
      ]
    };
    
    const fields = [];
    
    for (const [category, cmds] of Object.entries(commands)) {
      fields.push({
        name: category,
        value: cmds.join('\n'),
        inline: false
      });
    }
    
    const embed = createEmbed({
      title: `🍀 ${config.CASINO_NAME} - 📚 Centro de Ayuda Completo 🍀`,
      description: '**¡Bienvenido al casino! Aquí encontrarás todos los comandos disponibles**\n\n🎰 **JUEGOS COMPLETOS:** Blackjack (individual y mesa), Ruleta, Poker y Slots\n💰 **ECONOMÍA:** Sistema completo de balances, transacciones y fondos\n🎉 **EVENTOS:** Sorteos, apuestas deportivas, Inside Track y eventos del casino físico\n💎 **MEMBRESÍAS:** Sistema premium con niveles Silver, Gold y Platinum\n📢 **AUTOMATIZACIÓN:** Anuncios automáticos y eventos que se actualizan solos\n\n✨ **NOVEDADES:** Mesas permanentes, sistema de membresías, anuncios automáticos y más\n\n💡 *Usa `/ayuda` en cualquier momento para ver este mensaje*',
      fields,
      color: 0x50C878,
      footer: 'Emerald Isle Casino ® - ¡Que disfrutes jugando! 🍀'
    });
    
    await interaction.editReply({ embeds: [embed] });
  }
};
