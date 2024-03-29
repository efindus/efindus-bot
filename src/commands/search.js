const { ApplicationCommandOptionType, ComponentType } = require('discord.js');

const yt = require('../utils/youtube');
const models = require('../utils/models');
const { Video } = require('../structures/Video');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'search',
	description: 'Search a video on YouTube and add it to the queue.',
	options: [
		{
			name: 'query',
			type: ApplicationCommandOptionType.String,
			description: 'Video\'s title.',
			required: true,
		},
	],
	voiceRequirements: 2,
	deferReply: true,
	interactionTypes: {
		command: {
			enabled: true,
			ephemeral: true,
		},
		stringSelectMenu: {
			enabled: true,
		},
	},
	run: async ({ bot, interaction, player, interactionType }) => {
		if (interactionType === 'command') {
			const results = await yt.findVideos(interaction.options.getString('query'), 10);

			const videos = [];

			results.forEach((video) => {
				videos.push({
					label: video.title.length > 100 ? `${video.title.slice(0, 97)}...` : video.title,
					description: video.author,
					value: video.id,
				});
			});

			return new Response({
				customProperties: {
					content: '**Select a video:**',
					components: [
						{
							type: ComponentType.ActionRow,
							components: [
								{
									type: ComponentType.StringSelect,
									customId: 'search',
									placeholder: 'Select a video',
									options: videos,
								},
							],
						},
					],
					ephemeral: true,
				},
			});
		} else if (interactionType === 'stringSelectMenu') {
			/**
			 * @type {Video}
			 */
			const result = await yt.findVideos(Video.getURL(interaction.values[0]), 1);
			const position = await player.addToQueue([ result ]);

			return new Response({
				customFormatting: true,
				title: position === 0 ? `${bot.config.emotes.check} Now playing!` : `${bot.config.emotes.check} Video has been added to the queue! (#${position})`,
				message: `${models.formatVideo(result)}`,
				customEmbedProperties: {
					thumbnail: {
						url: result.thumbnailURL,
					},
					footer: {
						iconURL: interaction.member.displayAvatarURL(),
						text: `🔉 ${player.volume}% • Requested by: ${interaction.member.user.tag}`,
					},
				},
			});
		}
	},
});
