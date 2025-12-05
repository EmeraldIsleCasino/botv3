# Emerald Isle Casino ® - Discord Bot

## Overview
Professional Discord bot for **Emerald Isle Casino ®** with complete systems for economy, giveaways, sports betting, and horse racing (Inside Track).

## Project Type
Discord.js v14 bot with slash commands, button interactions, and SQLite databases.

## Current State
- All systems implemented and fully functional
- Admin-only slash commands
- User interactions via buttons and embeds
- Separate databases for each system
- Auto-save every 60 seconds
- **ALL CASINO GAMES USE OFFICIAL PROBABILITIES** (verified)

## Cambios Recientes
- **05 de Diciembre, 2025**: Sistema de Minijuegos y NFTs
  - 🎮 **10 MINIJUEGOS NUEVOS:**
    - **Mines** - Estilo Stake, grid 5x5 con multiplicadores progresivos
    - **Jackpot Rooms** - 3 salas (Small/Medium/High) con pozo comunitario
    - **Arena Duel** - PvP por turnos con habilidades especiales
    - **Nahcar Crash** - Carrera de carros con eventos aleatorios
    - **Boxing LS** - Boxeo PvP con sistema de stamina
    - **Penalty Shootout** - 5 rondas de penales con muerte súbita
    - **Wheel Xtreme** - Rueda con 20 sectores y JACKPOT 25x
    - **Bank Heist** - Atraco cooperativo con 4 roles
    - **Duck Race** - Carrera de 6 patos con obstáculos
    - **Tower** - Subir pisos evitando bombas (3 dificultades)
  - ⚽ **SISTEMA NFT DE CARTAS DE FÚTBOL:**
    - 20 jugadores iniciales (Messi, Ronaldo, Mbappé, Haaland, etc.)
    - 5 rarezas: Common, Rare, Epic, Legendary, Mythic
    - Bonos de ganancias (+2% a +15%) y suerte (+1% a +5%)
    - Drops aleatorios al ganar en minijuegos
    - Tienda para comprar cartas con fichas
    - Sistema de equipar/desequipar cartas
  - 📋 **COMANDOS NUEVOS:**
    - `/minijuegos` - Menú principal con 10 botones de juegos
    - `/mynfts` - Ver tu colección de cartas
    - `/nftshop` - Tienda de cartas NFT
    - `/nftadmin` - Administración de NFTs (Admin)
  - 🏗️ **ARQUITECTURA MODULAR:**
    - Todos los archivos nuevos en src/minigames/ y src/nfts/
    - Sin modificación de archivos existentes
    - CustomIds con namespace por juego (mines_, jackpot_, etc.)

- **04 de Diciembre, 2025**: Configuración para Replit
  - ✅ **CONFIGURADO PARA REPLIT:**
    - Workflow configurado para ejecutar el bot automáticamente
    - Dependencias instaladas (discord.js v14, better-sqlite3)
    - .gitignore creado para Node.js
    - Bases de datos SQLite existentes preservadas
    - Sistema listo para ejecutar con token de Discord

- **04 de Diciembre, 2025**: Reconstrucción Completa Sistema Ruleta
  - 🔧 **SISTEMA COMPLETAMENTE RECONSTRUIDO:**
    - Nuevo módulo limpio `src/systems/roulette/simple.js` basado en patrón blackjack
    - Todos los handlers consolidados en un solo bloque (~140 líneas vs ~350 líneas dispersas)
    - Eliminados todos los handlers viejos y código duplicado
    - Flujo simplificado: Seleccionar tipo → Ajustar apuesta → Girar
  - ✨ **NUEVAS CARACTERÍSTICAS:**
    - Botones de tipo cambian color al seleccionar (verde = activo)
    - Botón GIRAR se desactiva hasta tener tipo y apuesta válida
    - Animación de 2 segundos antes del resultado
    - Integración con membresías (bonos), torneos (puntos), y cashback (pérdidas)
  - ✅ **Sistema estable y probado**

- **01 de Diciembre, 2025**: Sistema de Anuncios Automáticos
  - ✨ **SISTEMA DE EMBEDS PARA PROMOCIÓN:**
    - Anuncios aleatorios cada 10 minutos
    - 8 mensajes diferentes invitando a apostar
    - Embeds con logos Emerald Isle (🍀)
    - Botón directo a canal de soporte para recargas
    - Se actualiza automáticamente sin borrar/recrear
  
- **30 de Noviembre, 2025**: Probabilidades Oficiales + Mesas Permanentes Completas
  - ✨ **PROBABILIDADES EXACTAS IMPLEMENTADAS:**
    - **Blackjack:** 55% banca - 45% jugador (probabilidad aleatoria en stand)
    - **Ruleta:** 44% jugador en apuestas par/impar/color (pago 2:1 condicional)
    - **Slots:** RTP 85-90% (multiplicadores y probabilidades ajustados)
    - **Poker:** 5% rake máximo 20 fichas, comparación justa (sin ventaja abrumadora)
  - ✨ **MESAS PERMANENTES/PRIVADAS COMPLETAS:**
    - Blackjack: Mesa privada como Ruleta con `deferReply()` + `editReply()`
    - Poker: Completamente convertido a mesa privada (todos los handlers usan `editReply()`)
    - Ruleta: Mesa privada ya funcional
  - ✨ **AISLAMIENTO DE SESIONES:**
    - Todos los botones incluyen UID en customId para evitar conflictos entre jugadores
    - Cada jugador recibe embeds privados independientes
  - ✨ **INFORMACIÓN DE RAKE EN POKER:**
    - Se muestra la comisión aplicada en cada mano
    - Cálculo automático: 5% de la apuesta, máximo 20 fichas

## Structure
```
src/
├── commands/           # Slash commands
│   ├── balance.js      # Check user balance
│   ├── recargar.js     # Add balance (admin)
│   ├── quitardinero.js # Remove balance (admin)
│   ├── fondos.js       # View all funds (admin)
│   ├── minijuegos.js   # Master menu for 10 minigames
│   ├── mynfts.js       # View NFT collection
│   ├── nftshop.js      # NFT card shop
│   ├── nftadmin.js     # NFT administration (admin)
│   └── ...             # Other commands
├── database/           # Database modules
│   ├── index.js        # DB initialization
│   ├── economy.js      # Economy operations
│   ├── minigames/      # NEW: Minigames database
│   │   └── index.js    # Stats, games, player data
│   └── ...             # Other databases
├── events/             # Event handlers
│   ├── clientReady.js  # Bot ready event
│   ├── interactionCreate.js # Main handler
│   └── minigamesHandler.js # NEW: Minigames handler
├── minigames/          # NEW: 10 Minigame modules
│   ├── mines/handler.js
│   ├── jackpot_rooms/handler.js
│   ├── arena_duel/handler.js
│   ├── nahcar_crash/handler.js
│   ├── boxing_ls/handler.js
│   ├── penalty_shootout/handler.js
│   ├── wheel_xtreme/handler.js
│   ├── bank_heist/handler.js
│   ├── duck_race/handler.js
│   └── tower/handler.js
├── nfts/               # NEW: NFT System
│   └── system/
│       ├── database.js # Cards, user inventory, bonuses
│       └── handler.js  # Shop, equip, inventory UI
├── systems/            # Casino game systems
│   ├── slots/          # Slots system
│   ├── blackjack/      # Blackjack system
│   ├── roulette/       # Roulette system
│   └── poker/          # Poker system
├── utils/              # Utilities
│   ├── config.js       # Bot configuration
│   └── embedBuilder.js # Embed helpers
└── index.js            # Main entry point
```

## Setup Instructions

### Local Setup (Replit)

#### 1. Get a Discord Bot Token
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or select an existing one
3. Go to the **Bot** section
4. Click "Reset Token" and copy the token
5. Enable these Privileged Gateway Intents:
   - Server Members Intent
   - Message Content Intent

#### 2. Add Token to Replit
1. Click the "Secrets" tab (lock icon) in Replit sidebar
2. Add a new secret:
   - Key: `DISCORD_BOT_TOKEN`
   - Value: Your bot token

#### 3. Invite Bot to Server
Use this URL format (replace CLIENT_ID with your app's ID):
```
https://discord.com/api/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

#### 4. Run the Bot
The bot will automatically start via the configured workflow.

### Deploy to Railway (24/7 Free)

Railway ofrece **500 horas gratis/mes** (suficiente para 24/7). Sigue estos pasos:

#### 1. Preparar el código
- El repositorio ya está listo para Railway
- Asegúrate de hacer push a GitHub

#### 2. Crear proyecto en Railway
1. Ve a [railway.app](https://railway.app)
2. Inicia sesión con GitHub
3. Haz clic en "New Project"
4. Selecciona "Deploy from GitHub repo"
5. Selecciona este repositorio

#### 3. Configurar Variables de Entorno
1. En Railway, ve a la pestaña "Variables"
2. Añade:
   - Key: `DISCORD_BOT_TOKEN`
   - Value: Tu token de Discord
3. Haz clic en "Deploy"

#### 4. Verificar que está corriendo
- Railway automáticamente ejecutará `npm start`
- El bot debería estar online en 1-2 minutos
- Ve a los Logs para verificar que todo está correcto

**Ventajas:**
✅ 500 horas gratis/mes (suficiente para 24/7)
✅ Escala automáticamente
✅ Reinicia automáticamente si falla
✅ Integración con GitHub para auto-deploy

**Notas importantes:**
- Las bases de datos SQLite se almacenan en memoria volátil - considera migrar a PostgreSQL si necesitas persistencia
- Railway proporciona 5GB de almacenamiento gratuito si necesitas persistencia de archivos

## Comandos

### 💰 Economía
| Comando | Descripción |
|---------|------------|
| `/balance` | Ver tu saldo (todos) o de otro usuario (Admin) |
| `/recargar @usuario cantidad` | Añadir saldo a un usuario (Admin) |
| `/quitardinero @usuario cantidad` | Quitar saldo a un usuario (Admin) |
| `/fondos` | Ver balances de todos los usuarios (Admin) |
| `/transacciones @usuario [límite]` | Ver historial de transacciones (Admin) |
| `/estadisticas` | Ver estadísticas generales del casino (Admin) |
| `/reseteconomia` | Resetear TODA la economía ⚠️ (Solo dueño servidor) |
| `/insidefondos` | Ver ganancias del Inside Track (Admin) |
| `/deportesfondos` | Ver ganancias de apuestas deportivas (Admin) |

### 🎉 Sorteos (Solo Admin)
| Comando | Descripción |
|---------|------------|
| `/crearsorteo premio` | Crear un nuevo sorteo |
| `/cerrarsorteo` | Cerrar sorteo y seleccionar ganador |
| `/borrarsorteo` | Eliminar sorteo activo |
| `/topganadores` | Ver top de ganadores |

### ⚽ Apuestas Deportivas (Solo Admin)
| Comando | Descripción |
|---------|------------|
| `/crearevento` | Crear evento deportivo |
| `/cerrarevento` | Cerrar apuestas |
| `/finalizarevento ganador` | Finalizar evento y pagar |
| `/eliminarevento` | Eliminar evento y devolver apuestas |

### 🏇 Inside Track (Solo Admin)
| Comando | Descripción |
|---------|------------|
| `/insidetrack` | Iniciar carrera de caballos |
| `/borrarinsidetrack` | Eliminar carrera y devolver apuestas |

### 🎰 Juegos (Todos los usuarios)
| Comando | Descripción |
|---------|------------|
| `/blackjackmesa` | Crear mesa única de Blackjack (admin) |
| `/ruletamesa` | Crear mesa única de Ruleta (admin) |
| `/pokermesa` | Crear mesa única de Poker (admin) |

### 🎮 Minijuegos (Todos los usuarios)
| Comando | Descripción |
|---------|------------|
| `/minijuegos` | Menú con 10 minijuegos interactivos |

**Juegos disponibles:**
- **Mines** - Grid 5x5, revela casillas evitando minas
- **Jackpot** - 3 salas con pozo comunitario
- **Arena Duel** - PvP por turnos con habilidades
- **Nahcar Crash** - Carrera con eventos aleatorios
- **Boxing LS** - Boxeo PvP con stamina
- **Penalty** - Penales PvP (5 rondas)
- **Wheel Xtreme** - Rueda con JACKPOT 25x
- **Bank Heist** - Atraco cooperativo (4 roles)
- **Duck Race** - Carrera de patos
- **Tower** - Sube pisos evitando bombas

### ⚽ NFT de Cartas (Todos los usuarios)
| Comando | Descripción |
|---------|------------|
| `/mynfts` | Ver tu colección de cartas |
| `/nftshop` | Tienda de cartas NFT |
| `/nftadmin` | Administración de NFTs (Admin) |

**Sistema NFT:**
- 20 jugadores de fútbol (Messi, Ronaldo, etc.)
- 5 rarezas con bonos progresivos
- Drops aleatorios al ganar minijuegos
- Equipar carta para aplicar bonos

### 📢 Anuncios & Promoción
| Comando | Descripción |
|---------|------------|
| `/startanuncios` | Inicia sistema de anuncios cada 10 minutos (Admin) |
| `/stopanuncios` | Detiene sistema de anuncios (Admin) |
| `/eventoscasino` | Eventos del casino físico (/prop 2188) cada 10 minutos (Admin) |

### ⚙️ Utilidad
| Comando | Descripción |
|---------|------------|
| `/guardar` | Guardar todas las bases de datos (Admin) |
| `/limpiar cantidad` | Borrar últimos N mensajes del canal (Admin) |
| `/ayuda` | Ver lista de comandos disponibles (todos) |
| `/checkganadores [deporte]` | Ver ganadores/perdedores de apuestas (Admin) |

## Game Mechanics & Probabilities

### Blackjack (Mesa Privada)
- **Probabilidades:** 55% banca - 45% jugador
- **Mecanismo:** El jugador solo gana si vence la banca Y supera el threshold de 45%
- **Mesas:** Privadas - cada jugador ve su partida en embed independiente
- **Apuestas:** $100-$5000
- **Payout:** 1.5x en ganancias

### Ruleta (Mesa Privada)
- **Probabilidades:** 44% jugador en rojo/negro/par/impar
- **Mecanismo:** Solo paga 2:1 si resultado físico correcto Y pasa el 44% de probabilidad
- **Mesas:** Privadas - cada jugador recibe embed independiente
- **Apuestas:** $100-$5000
- **Tipos:** Rojo/Negro (2:1), Par/Impar (2:1), Números específicos (36:1)

### Poker (Mesa Privada)
- **Comisión (Rake):** 5% de la apuesta, máximo 20 fichas
- **Mecanismo:** Comparación justa de manos sin ventaja abrumadora
- **Mesas:** Privadas - cada jugador juega independientemente con la banca
- **Apuestas:** $100-$5000
- **Variante:** Texas Hold'em vs Banca con cambio de cartas (draw)

### Slots
- **RTP:** 85-90% (retorno teórico)
- **Probabilidades:** Triple 0.7-1.2%, Double 3-5%, Jackpot 0.008-0.015%
- **Multiplicadores:** Triple 2.5-4.5x, Double 1.0-1.4x, Jackpot 10-25x
- **Apuestas:** $100-$5000
- **Juegos:** 7 temas diferentes

## Game Session Isolation
- Cada botón incluye el UID del jugador en su customId (ej: `bj_deal_${uid}`)
- Las sesiones de juego se almacenan en Maps independientes por usuario
- Las respuestas privadas (`deferReply({ flags: 64 })`) aseguran visualización exclusiva
- Múltiples jugadores pueden jugar simultáneamente sin interferencias

## Environment Variables
- `DISCORD_BOT_TOKEN` (required): Your Discord bot token

## Database Files
All data is stored in the `data/` directory:
- `economy.db` - User balances and transactions
- `giveaways.db` - Giveaway data and winners
- `sports.db` - Sports events and bets
- `insidetrack.db` - Race data and bets

## Anuncios Automáticos

El sistema `/startanuncios` envía embeds promocionales que se actualizan cada 10 minutos:

**8 Mensajes Aleatorios:**
1. 🍀 Bienvenida al casino (general)
2. 🥊 Invitación a boxeo
3. ⚽ Invitación a futbol
4. 🏆 Promoción de premios
5. 🎰 Promoción de slots
6. 🍀 Promoción de blackjack/ruleta/poker
7. 🐴 Promoción de Inside Track
8. 💎 Mensaje premium sobre el casino

**Cada anuncio incluye:**
- Embed con título y descripción
- Botón "⚡ Ir a Apostar" hacia canal de soporte
- Link al canal de recargas de saldo
- Actualización automática cada 10 minutos

**Uso:**
```
/startanuncios canal:#anuncios
```

## Notes
- All admin commands are ephemeral (only visible to admin)
- User messages with commands are automatically hidden
- Databases auto-save every 60 seconds
- All financial data is private to admins
- Casino games use private ephemeral responses for player isolation
- All probabilities are mathematically verified and enforced at runtime
- Anuncios se actualizan sin recrear el mensaje (editan el existente)
