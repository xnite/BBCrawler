/*
 * I do not do anything with Discord bots at all so please do not jump down my throat about how this is not the best way to do this or that.
 * If you have a better way to do this, please submit a PR.
 */
const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');
const axios = require("axios");
const commandos = require('commandos');
const Discord = require('discord.js');
const {REST, Routes, Events} = require('discord.js');

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
    Discord.GatewayIntentBits.GuildBans,
    Discord.GatewayIntentBits.GuildEmojisAndStickers,
    Discord.GatewayIntentBits.GuildIntegrations,
    Discord.GatewayIntentBits.GuildWebhooks,
    Discord.GatewayIntentBits.GuildInvites,
    Discord.GatewayIntentBits.GuildVoiceStates,
    Discord.GatewayIntentBits.GuildMessages,
    Discord.GatewayIntentBits.GuildMessageReactions,
    Discord.GatewayIntentBits.GuildMessageTyping,
    Discord.GatewayIntentBits.DirectMessages,
    Discord.GatewayIntentBits.DirectMessageReactions,
    Discord.GatewayIntentBits.DirectMessageTyping,
    Discord.GatewayIntentBits.GuildScheduledEvents,
    Discord.GatewayIntentBits.MessageContent
  ]
});


client.commands = new Discord.Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
      console.log("Registering command: " + command.data.name);
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
commands = [
  {
    name: "search",
    description: "Search for servers in the database.",
    options: [
      {
        name: "asn",
        description: "Search by ASN.",
        type: 3,
        required: false
      },
      {
        name: "country",
        description: "Search by country.",
        type: 3,
        required: false
      },
      {
        name: "country_code",
        description: "Search by country code.",
        type: 3,
        required: false
      },
      {
        name: "org",
        description: "Search by organization.",
        type: 3,
        required: false
      },
      {
        name: "region",
        description: "Search by region.",
        type: 3,
        required: false
      },
      {
        name: "version",
        description: "Search by version.",
        type: 3,
        required: false
      },
      {
        name: "extended",
        description: "Show extended information.",
        type: 5,
        required: false
      }
    ]
  },
  {
    name: "status",
    description: "Check the status of the API."
  },
  {
    name: "scan",
    description: "Scan for servers on the internet",
    options: [
      {
        name: "range",
        description: "The IP address range to scan.",
        type: 3,
        required: true
      },
      {
        name: "ports",
        description: "The port, or range of ports, to scan.",
        type: 3,
        required: false
      }
    ]
  }
];

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env["DISCORD_CLIENT_ID"], process.env["DISCORD_GUILD_ID"]),
			{ body: commands },
		);

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();


client.on("ready", () => {
  console.log("I am ready!");
});

client.on(Events.InteractionCreate, async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const command = interaction.client.commands.get(interaction.commandName);

	if (!command) {
		console.error(`No command matching ${interaction.commandName} was found.`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		console.error(error);
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
		} else {
			await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
		}
	}
});

client.login(process.env.DISCORD_TOKEN);