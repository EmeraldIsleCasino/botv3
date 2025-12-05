const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createEmbed, errorEmbed, successEmbed } = require('../utils/embedBuilder');
const nftDb = require('../nfts/system/database');
const config = require('../utils/config');

const RARITY_EMOJIS = {
  common: '⚪',
  rare: '🔵',
  epic: '🟣',
  legendary: '🟠',
  mythic: '💎'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nftadmin')
    .setDescription('Comandos de administración de NFTs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Ver todas las cartas NFT existentes')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('owners')
        .setDescription('Ver dueños de una carta específica')
        .addStringOption(option =>
          option.setName('carta')
            .setDescription('Slug de la carta (ej: messi, ronaldo)')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('precio')
        .setDescription('Ajustar precio de una carta')
        .addStringOption(option =>
          option.setName('carta')
            .setDescription('Slug de la carta')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('precio')
            .setDescription('Nuevo precio')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('dar')
        .setDescription('Dar una carta a un usuario')
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuario que recibirá la carta')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('carta')
            .setDescription('Slug de la carta')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('agregar')
        .setDescription('Agregar una nueva carta NFT')
        .addStringOption(option =>
          option.setName('slug')
            .setDescription('Identificador único (ej: nuevo_jugador)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('nombre')
            .setDescription('Nombre completo del jugador')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('rareza')
            .setDescription('Rareza de la carta')
            .setRequired(true)
            .addChoices(
              { name: 'Común', value: 'common' },
              { name: 'Raro', value: 'rare' },
              { name: 'Épico', value: 'epic' },
              { name: 'Legendario', value: 'legendary' },
              { name: 'Mítico', value: 'mythic' }
            )
        )
        .addStringOption(option =>
          option.setName('posicion')
            .setDescription('Posición (ST, RW, CM, etc)')
            .setRequired(true)
        )
        .addStringOption(option =>
          option.setName('club')
            .setDescription('Club del jugador')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option.setName('overall')
            .setDescription('Overall del jugador')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(99)
        )
        .addIntegerOption(option =>
          option.setName('precio')
            .setDescription('Precio en tienda')
            .setRequired(true)
            .setMinValue(0)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('eliminar')
        .setDescription('Desactivar una carta NFT')
        .addStringOption(option =>
          option.setName('carta')
            .setDescription('Slug de la carta a desactivar')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'listar') {
      await interaction.deferReply({ flags: 64 });
      
      const cards = nftDb.getAllCards();
      
      let description = `**Cartas NFT en el sistema (${cards.length}):**\n\n`;
      
      const byRarity = {};
      for (const card of cards) {
        if (!byRarity[card.rarity]) byRarity[card.rarity] = [];
        byRarity[card.rarity].push(card);
      }
      
      for (const [rarity, rarityCards] of Object.entries(byRarity)) {
        description += `${RARITY_EMOJIS[rarity]} **${rarity.toUpperCase()}** (${rarityCards.length}):\n`;
        for (const card of rarityCards.slice(0, 5)) {
          description += `  • ${card.name} (${card.slug}) - ${config.CURRENCY_SYMBOL} ${card.price.toLocaleString()}\n`;
        }
        if (rarityCards.length > 5) {
          description += `  *...y ${rarityCards.length - 5} más*\n`;
        }
        description += `\n`;
      }

      const embed = createEmbed({
        title: `🍀 ${config.CASINO_NAME} - NFT ADMIN 🍀`,
        description,
        color: 0x9b59b6,
        footer: 'Emerald Isle Casino ® - Administración NFT'
      });

      await interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'owners') {
      await interaction.deferReply({ flags: 64 });
      
      const slug = interaction.options.getString('carta');
      const card = nftDb.getCardBySlug(slug);
      
      if (!card) {
        return interaction.editReply({
          embeds: [errorEmbed(`Carta "${slug}" no encontrada.`)]
        });
      }
      
      const owners = nftDb.getCardOwners(card.id);
      
      let description = `${RARITY_EMOJIS[card.rarity]} **${card.name}**\n\n`;
      description += `**Dueños (${owners.length}):**\n\n`;
      
      if (owners.length === 0) {
        description += `*Nadie posee esta carta*`;
      } else {
        for (const owner of owners.slice(0, 20)) {
          const equipped = owner.equipped ? ' 🎯' : '';
          description += `• <@${owner.user_id}> x${owner.quantity}${equipped}\n`;
        }
        if (owners.length > 20) {
          description += `\n*...y ${owners.length - 20} más*`;
        }
      }

      const embed = createEmbed({
        title: `🍀 ${config.CASINO_NAME} - DUEÑOS NFT 🍀`,
        description,
        color: 0x9b59b6,
        footer: 'Emerald Isle Casino ® - Administración NFT'
      });

      await interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'precio') {
      await interaction.deferReply({ flags: 64 });
      
      const slug = interaction.options.getString('carta');
      const precio = interaction.options.getInteger('precio');
      
      const card = nftDb.getCardBySlug(slug);
      if (!card) {
        return interaction.editReply({
          embeds: [errorEmbed(`Carta "${slug}" no encontrada.`)]
        });
      }
      
      nftDb.setCardPrice(slug, precio);
      
      await interaction.editReply({
        embeds: [successEmbed(`✅ Precio de **${card.name}** actualizado a ${config.CURRENCY_SYMBOL} ${precio.toLocaleString()}`)]
      });
    }

    if (subcommand === 'dar') {
      await interaction.deferReply({ flags: 64 });
      
      const user = interaction.options.getUser('usuario');
      const slug = interaction.options.getString('carta');
      
      const card = nftDb.getCardBySlug(slug);
      if (!card) {
        return interaction.editReply({
          embeds: [errorEmbed(`Carta "${slug}" no encontrada.`)]
        });
      }
      
      nftDb.grantCard(user.id, card.id, 'admin_grant');
      
      await interaction.editReply({
        embeds: [successEmbed(`✅ **${card.name}** (${card.rarity}) otorgada a ${user}`)]
      });
    }

    if (subcommand === 'agregar') {
      await interaction.deferReply({ flags: 64 });
      
      const cardData = {
        slug: interaction.options.getString('slug'),
        name: interaction.options.getString('nombre'),
        rarity: interaction.options.getString('rareza'),
        position: interaction.options.getString('posicion'),
        club: interaction.options.getString('club'),
        nation: 'N/A',
        overall: interaction.options.getInteger('overall'),
        price: interaction.options.getInteger('precio'),
        bonus_type: 'winnings',
        bonus_value: { common: 0.02, rare: 0.05, epic: 0.08, legendary: 0.12, mythic: 0.15 }[interaction.options.getString('rareza')],
        drop_weight: { common: 0.15, rare: 0.08, epic: 0.04, legendary: 0.02, mythic: 0.01 }[interaction.options.getString('rareza')]
      };
      
      try {
        nftDb.addCard(cardData);
        await interaction.editReply({
          embeds: [successEmbed(`✅ Carta **${cardData.name}** (${cardData.rarity}) creada con éxito.`)]
        });
      } catch (error) {
        await interaction.editReply({
          embeds: [errorEmbed(`Error al crear carta: ${error.message}`)]
        });
      }
    }

    if (subcommand === 'eliminar') {
      await interaction.deferReply({ flags: 64 });
      
      const slug = interaction.options.getString('carta');
      const card = nftDb.getCardBySlug(slug);
      
      if (!card) {
        return interaction.editReply({
          embeds: [errorEmbed(`Carta "${slug}" no encontrada.`)]
        });
      }
      
      nftDb.removeCard(slug);
      
      await interaction.editReply({
        embeds: [successEmbed(`✅ Carta **${card.name}** desactivada.`)]
      });
    }
  }
};
