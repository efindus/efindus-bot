const { logger } = require('./logger');

/**
 * @type {import('../bot').Bot}
 */
let bot = null;
/**
 * @param {import('../bot').Bot} instance
 */
const initializeErrorHandler = (instance) => bot = instance;

const errorToString = (err) => err.stack ?? err.message ?? 'Unknown error occurred!';

const sanitizeString = (str) => str.replace(/`/g, '\'');

/**
 * @param {Error} error - The error
 * @param {object} errorMeta - Metadata about the error
 * @param {string} errorMeta.guildId
 * @param {string} errorMeta.userId
 * @param {import('discord.js').Interaction} interaction
 */
const handleError = async (error, errorMeta, interaction) => {
	const err = errorToString(error);
	logger.error(err);

	if (process.env.NODE_ENV === 'development')
		return;

	if (!bot)
		return;

	try {
		const embedFields = [
			{
				name: '**[Error]:**',
				value: `\`\`\`${err.slice(0, 1018)}\`\`\``,
			},
		];

		if (errorMeta?.userId) {
			embedFields.splice(0, 0,
				{
					name: '**[User ID]:**',
					value: `\`${errorMeta.userId}\``,
					inline: true,
				},
				{
					name: '**[User Name]:**',
					value: `\`${sanitizeString((await bot.client.users.fetch(errorMeta.userId)).tag)}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
			);
		}

		if (errorMeta?.guildId) {
			embedFields.splice(0, 0,
				{
					name: '**[Server ID]:**',
					value: `\`${errorMeta.guildId}\``,
					inline: true,
				},
				{
					name: '**[Server Name]:**',
					value: `\`${sanitizeString((await bot.client.guilds.fetch(errorMeta.guildId)).name)}\``,
					inline: true,
				},
				{
					name: '',
					value: '',
					inline: true,
				},
			);
		}

		let embedDescription = undefined;

		if (interaction) {
			let commandInfo = `name: ${interaction.commandName ?? interaction.customId}`;
			if (interaction.options)
				commandInfo += `, args: [ ${interaction.options.data.map(opt => `{ n: ${opt.name}, v: ${opt.value ?? '[NONE]'} }`).join(', ')} ]`;

			embedDescription = `**[Command]:**\n\`\`\`${sanitizeString(commandInfo)}\`\`\``;
		}

		(await bot.client.channels.fetch(bot.config.channels.errors)).send({
			embeds: [
				{
					title: `${bot.config.emotes.cross} **Error occurred:**`,
					description: embedDescription,
					color: bot.config.colors.red,
					fields: embedFields,
				},
			],
		});
	} catch (e) {
		logger.error(errorToString(e));
	}
};

/**
 * Error caused by the user. Should not be logged to console.
 */
class UserError extends Error {}

(() => {
	process.on('uncaughtException', (error) => {
		handleError(error);
	});

	process.on('unhandledRejection', (error) => {
		handleError(error);
	});

	const oldEmit = process.emitWarning;
	process.emitWarning = (warning, ctor) => {
		if (warning.includes('Fetch API'))
			return;
		else
			oldEmit(warning, ctor);
	};
})();

module.exports = { initializeErrorHandler, handleError, UserError };
