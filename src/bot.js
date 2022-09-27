const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

require('./utils/array');
const { logger } = require('./utils/logger');
const { PlayerManager } = require('./modules/PlayerManager');
const { CommandManager } = require('./modules/CommandManager');
const { DatabaseManager } = require('./modules/DatabaseManager');

class Bot {
	client;
	config;
	playerManager;
	commandManager;
	databaseManager;

	/**
	 * @param {object} data
	 * @param {string} data.botToken
	 * @param {string} data.mongoConnectionString
	 * @param {import('../config.example')} data.config
	 */
	constructor(data) {
		this.config = data.config;

		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
			],
			ws: {
				properties: {
					browser: 'Discord Android',
				},
			},
		});

		this.playerManager = new PlayerManager(this);
		this.commandManager = new CommandManager(this);
		this.databaseManager = new DatabaseManager(this, data.mongoConnectionString);

		logger.info('Connecting to database...');
		this.databaseManager.connect().then(() => {
			logger.info('Connected to database!');
			logger.info('Connecting to Discord gateway...');
			this.client.login(data.botToken);
		});

		this.client.on('ready', () => {
			this.client.user.setActivity({
				type: ActivityType.Playing,
				name: 'with slash commands!',
			});

			logger.ready(`${this.client.user.tag} is ready!`);
		});
	}
}

module.exports = { Bot };
