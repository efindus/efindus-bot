const { ApplicationCommandOptionType, ComponentType, ButtonStyle } = require('discord.js');

const models = require('../utils/models');
const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

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
	run: async (bot, interaction) => {
		const player = bot.playerManager.getPlayer(interaction.guild.id);

		let generatedQueue;
		if (interaction.isCommand()) {
			const pageIndex = (interaction.options.getInteger('page') ?? 1) - 1;
			if (pageIndex < 0 || player.lastQueuePage < pageIndex)
				throw new UserError('Invalid page number!');

			generatedQueue = models.formatQueue(player, pageIndex);
			if (generatedQueue.formattedQueue.length === 0)
				throw new UserError('Nothing is currently playing!');
		} else if (interaction.isButton()) {
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
			message: generatedQueue.formattedQueue,
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
					text: `Page ${generatedQueue.pageIndex + 1}/${player.lastQueuePage + 1}`,
				},
			},
		});
	},
});
