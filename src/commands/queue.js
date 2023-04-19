const { ApplicationCommandOptionType, ComponentType, ButtonStyle } = require('discord.js');

const models = require('../utils/models');
const { Command, Response, ResponseError } = require('../structures/Command');

module.exports = new Command({
	name: 'queue',
	description: 'Display the queue.',
	options: [
		{
			name: 'page',
			type: ApplicationCommandOptionType.Integer,
			description: 'Number of page in queue to show.',
			required: false,
		},
	],
	editsMessage: true,
	deferReply: true,
	voiceRequirements: 1,
	interactionTypes: {
		command: {
			enabled: true,
		},
		button: {
			enabled: true,
			voiceRequirements: 0,
		},
	},
	run: async ({ interaction, player, bot, interactionType }) => {
		let generatedQueue;
		if (interactionType === 'command') {
			const pageIndex = (interaction.options.getInteger('page') ?? 1) - 1;
			if (pageIndex < 0 || player.lastQueuePage < pageIndex)
				throw new ResponseError('Invalid page number!');

			generatedQueue = models.formatQueue(player, pageIndex);
		} else if (interactionType === 'button') {
			const tokens = interaction.customId.split('-');
			if (!player || +tokens[2] !== player.creationTS)
				return;

			if (tokens[1] === 'left')
				generatedQueue = models.formatQueue(player, +tokens[3] - 1);
			else
				generatedQueue = models.formatQueue(player, +tokens[3] + 1);
		}

		return new Response({
			customFormatting: true,
			message: generatedQueue.pageIndex === -1 ? `${bot.config.emotes.cross} ${generatedQueue.formattedQueue}` : generatedQueue.formattedQueue,
			components: [
				{
					type: ComponentType.ActionRow,
					components: [
						{
							type: ComponentType.Button,
							customId: `queue-left-${player.creationTS}-${generatedQueue.pageIndex}`,
							label: '<',
							style: ButtonStyle.Primary,
						},
						{
							type: ComponentType.Button,
							customId: `queue-right-${player.creationTS}-${generatedQueue.pageIndex}`,
							label: '>',
							style: ButtonStyle.Primary,
						},
					],
				},
			],
			customEmbedProperties: {
				footer: {
					iconURL: interaction.member.displayAvatarURL(),
					text: generatedQueue.pageIndex === -1 ? null : `Page ${generatedQueue.pageIndex + 1}/${player.lastQueuePage + 1}`,
				},
				color: generatedQueue.color === 'red' ? bot.config.colors.red : undefined,
			},
		});
	},
});
