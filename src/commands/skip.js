const { ApplicationCommandOptionType } = require('discord.js');

const models = require('../utils/models');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'skip',
	description: 'Skip a video.',
	options: [
		{
			name: 'position',
			type: ApplicationCommandOptionType.Integer,
			description: 'Video\'s position in the queue.',
			required: false,
		},
		{
			name: 'amount',
			type: ApplicationCommandOptionType.Integer,
			description: 'Amount of videos to remove.',
			required: false,
		},
	],
	deferReply: true,
	voiceRequirements: 2,
	run: async ({ bot, interaction, player }) => {
		const index = interaction.options.getInteger('position'), amount = interaction.options.getInteger('amount') ?? 1;

		const removed = await player.skip(index, amount);
		return new Response({
			customFormatting: true,
			message: `${bot.config.emotes.check} ${models.formatVideo(removed[0])} ${removed.length > 1 ? `and ${removed.length - 1} more video${removed.length - 1 === 1 ? '' : 's'} have` : 'has'} been skipped!`,
		});
	},
});
