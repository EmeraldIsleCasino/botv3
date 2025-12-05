const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { initializeDatabases } = require("./database");

// Start HTTP server IMMEDIATELY for Render port detection
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('OK');
}).listen(PORT, '0.0.0.0');
console.log(`[HTTP] Server started on port ${PORT}`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

const commands = [];
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
    console.log(`[Commands] Loaded: ${command.data.name}`);
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
  console.log(`[Events] Loaded: ${event.name}`);
}

async function deployCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error(
      "[Error] DISCORD_BOT_TOKEN not found in environment variables",
    );
    process.exit(1);
  }

  const rest = new REST().setToken(token);

  try {
    console.log("[Deploy] Refreshing application commands...");

    const clientId = Buffer.from(token.split(".")[0], "base64").toString();

    await rest.put(Routes.applicationCommands(clientId), { body: commands });

    console.log(
      "[Deploy] Successfully registered application commands globally",
    );
  } catch (error) {
    console.error("[Deploy] Error deploying commands:", error);
  }
}

async function main() {
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    console.error("[Error] DISCORD_BOT_TOKEN not found");
    process.exit(1);
  }

  console.log("[Database] Initializing databases...");
  initializeDatabases();

  console.log("[Bot] Deploying commands...");
  await deployCommands();

  console.log("[Bot] Logging in...");
  await client.login(token);
}

main().catch((error) => {
  console.error("[Fatal Error]", error);
  process.exit(1);
});
