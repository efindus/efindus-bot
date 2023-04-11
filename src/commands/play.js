const { ApplicationCommandOptionType } = require('discord.js');

const yt = require('../utils/youtube');
const models = require('../utils/models');
const { Playlist } = require('../structures/Playlist');
const { UserError } = require('../utils/errorHandler');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'play',
	description: 'Add a video to the queue.',
	options: [
		{
			name: 'query',
			type: ApplicationCommandOptionType.String,
			description: 'Video\'s title.',
			required: true,
		},
		{
			name: 'position',
			type: ApplicationCommandOptionType.Integer,
			description: 'Index in the queue before which the video is going to be added. 0 will replace currently played one.',
			required: false,
		},
	],
	deferReply: true,
	voiceRequirements: 2,
	run: async ({ bot, interaction, player }) => {
		const result = await yt.findVideos(interaction.options.getString('query'), 1), requestedPosition = interaction.options.getInteger('position');

		if (requestedPosition < 0 || player.queueLength < requestedPosition)
			throw new UserError('Invalid position requested!');

		if (result instanceof Playlist) {
			const position = await player.addToQueue(result.videos, requestedPosition);

			return new Response({
				title: `${bot.config.emotes.check} Playlist has been added to the queue [${result.videos.length + 1} video${result.videos.length + 1 === 1 ? '' : 's'}]! (#${position})`,
				message: `[${result.title}](${result.thumbnailURL}) by **${result.author}**`,
				customFormatting: true,
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
		} else {
			const position = await player.addToQueue([ result ], requestedPosition);

			return new Response({
				title: position === 0 ? `${bot.config.emotes.check} Now playing!` : `${bot.config.emotes.check} Video has been added to the queue! (#${position})`,
				message: `${models.formatVideo(result)}`,
				customFormatting: true,
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
