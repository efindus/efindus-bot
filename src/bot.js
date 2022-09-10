const { Client, GatewayIntentBits, ApplicationCommandOptionType, ActivityType, ComponentType, ButtonStyle } = require('discord.js');

require('./utils/array');
const yt = require('./utils/youtube');
const parse = require('./utils/parse');
const models = require('./utils/models');
const { logger } = require('./utils/logger');
const { UserError } = require('./utils/errors');
const { PlayerManager } = require('./modules/playermanager');
const { CommandManager } = require('./modules/commandmanager');

class Bot {
	client;
	playerManager;
	commandManager;

	/**
	 * @param {object} data
	 * @param {string} data.botToken
	 */
	constructor(data) {
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

		this.client.login(data.botToken);

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
