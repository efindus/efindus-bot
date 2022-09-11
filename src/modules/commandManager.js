const { join, resolve } = require('path');

const { Command } = require('./command');
const { logger } = require('../utils/logger');
const { UserError } = require('../utils/errors');

/**
 * @param {import('../bot').Bot} bot
 * @param {import('discord.js').Interaction} interaction
 * @param {number} type
 */
const verifyVoiceRequirements = async (bot, interaction, type) => {
	if (type === 0)
		return;

	if (!interaction.guild.members.me.voice.channel || !bot.playerManager.getPlayer(interaction.guild.id)) {
		if (interaction.member.voice.channelId)
			await bot.playerManager.connect(interaction.member);
		else
			throw new UserError('I\'m not connected to any voice channel on this server.');
	}

	if (type === 2) {
		if (interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
			throw new UserError(`You're not connected to <#${interaction.guild.members.me.voice.channelId}>`);
	}
};

class CommandManager {
	/**
	 * @type {Record<string, Command>}
	 */
	#commands = {};

	/**
	 * @param {import('../bot').Bot} bot - Bot instance
	 */
	constructor(bot) {
		const basePath = join(resolve('.'), 'src/commands');
		const files = require('fs').readdirSync(basePath);
		const commands = [];

		for (const file of files) {
			if (!file.startsWith('--') && file.endsWith('.js')) {
				const command = require(join(basePath, file));

				if (command instanceof Command) {
					if (this.#commands[command.commandObject.name])
						throw new Error(`Duplicated command name: ${command.commandObject.name}.`);

					this.#commands[command.commandObject.name] = command;
					commands.push(command.commandObject);
				}
			}
		}

		bot.client.on('ready', () => {
			bot.client.application.commands.set(commands);
		});

		bot.client.on('interactionCreate', async (interaction) => {
			let interactionType = '', commandName = interaction.commandName ?? '';
			if (interaction.isCommand())
				interactionType = 'command', commandName = interaction.commandName;
			else if (interaction.isButton())
				interactionType = 'button', commandName = interaction.customId.split('-')[0];
			else if (interaction.isSelectMenu())
				interactionType = 'selectMenu', commandName = interaction.customId.split('-')[0];

			const command = this.#commands[commandName];
			if (!command || !interaction.guild && !command.availableInDMs)
				return;

			if (!Object.keys(command.interactionTypes).includes(interactionType) || !command.interactionTypes[interactionType].enabled)
				return;

			const interactionTypeData = command.interactionTypes[interactionType];
			try {
				if (interactionTypeData.deferReply ?? command.deferReply) {
					if (command.editsMessage && interactionType !== 'command') {
						await interaction.deferUpdate();
					} else {
						await interaction.deferReply({
							ephemeral: interactionTypeData.ephemeral ?? command.ephemeral,
						});
					}
				}

				await verifyVoiceRequirements(bot, interaction, interactionTypeData.voiceRequirements ?? command.voiceRequirements);

				const response = await command.run({
					bot,
					interaction,
					player: bot.playerManager.getPlayer(interaction.guild.id),
				});

				if (!response) {
					if (!command.deferReply) {
						if (interactionType !== 'command')
							await interaction.deferUpdate();
						else
							await interaction.deferReply();
					}

					return;
				}

				const replyObject = response.customProperties ?? {
					embeds: [
						{
							title: response.title,
							description: response.message.length !== 0 ? (response.customFormatting ? response.message : `${bot.config.emotes.check} **${response.message}**`) : null,
							color: bot.config.colors.main,
							author: {
								name: bot.client.user.username,
								iconURL: bot.client.user.displayAvatarURL(),
							},
							...response.customEmbedProperties,
						},
					],
					components: response.components,
				};

				if (command.editsMessage || (interactionTypeData.deferReply ?? command.deferReply))
					await interaction.editReply(replyObject);
				else
					await interaction.reply(replyObject);
			} catch (error) {
				if (!(error instanceof UserError)) {
					logger.error(error.stack ?? error.message);
					error.message = 'An unexpected error occured. Please notify @Findus#7449';
				}

				const replyObject = {
					embeds: [
						{
							description: `${bot.config.emotes.cross} **${error.message}**`,
							color: bot.config.colors.red,
							author: {
								name: bot.client.user.username,
								iconURL: bot.client.user.displayAvatarURL(),
							},
						},
					],
				};

				if (interactionTypeData.deferReply ?? command.deferReply)
					await interaction.editReply(replyObject);
				else
					await interaction.reply(replyObject);
			}
		});
	}
}

module.exports = { CommandManager };
