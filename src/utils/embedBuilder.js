const { EmbedBuilder } = require('discord.js');
const config = require('./config');

function createEmbed(options = {}) {
  const embed = new EmbedBuilder()
    .setColor(options.color || config.EMBED_COLOR)
    .setTitle(options.title || config.CASINO_NAME)
    .setThumbnail(options.thumbnail || config.LOGO_URL)
    .setTimestamp();

  if (options.description) embed.setDescription(options.description);
  if (options.fields) embed.addFields(options.fields);
  if (options.footer) embed.setFooter({ text: options.footer });
  if (options.image) embed.setImage(options.image);

  return embed;
}

function successEmbed(description, fields = []) {
  return createEmbed({
    description: `✅ ${description}`,
    fields,
    footer: config.CASINO_NAME
  });
}

function errorEmbed(description) {
  return createEmbed({
    color: 0xFF0000,
    description: `❌ ${description}`,
    footer: config.CASINO_NAME
  });
}

function infoEmbed(description, fields = []) {
  return createEmbed({
    description,
    fields,
    footer: config.CASINO_NAME
  });
}

module.exports = { createEmbed, successEmbed, errorEmbed, infoEmbed };
