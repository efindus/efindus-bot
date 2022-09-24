const { ApplicationCommandOptionType, ComponentType } = require('discord.js');

const yt = require('../utils/youtube');
const parse = require('../utils/parse');
const models = require('../utils/models');
const { Command, Response } = require('../modules/command');

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
		selectMenu: {
			enabled: true,
		},
	},
	run: async ({ bot, interaction, player }) => {
		if (interaction.isCommand()) {
			/**
			 * @type {import('../index').QueueVideo[]}
			 */
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
									type: ComponentType.SelectMenu,
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
		} else if (interaction.isSelectMenu()) {
			/**
			 * @type {import('../index').QueueVideo}
			 */
			const result = await yt.findVideos(parse.getVideoURL(interaction.values[0]), 1);
			const position = await player.addToQueue([ result ]);

			return new Response({
				customFormatting: true,
				title: position === 0 ? `${bot.config.emotes.check} Now playing!` : `${bot.config.emotes.check} Video has been added to the queue! (#${position})`,
				message: `${models.formatVideo(result)}`,
				customEmbedProperties: {
					thumbnail: {
						url: parse.getVideoThumbnailURL(result.id),
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
