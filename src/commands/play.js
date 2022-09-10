const { ApplicationCommandOptionType } = require('discord.js');

const yt = require('../utils/youtube');
const parse = require('../utils/parse');
const models = require('../utils/models');
const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

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
	run: async (bot, interaction) => {
		const player = bot.playerManager.getPlayer(interaction.guild.id);
		const results = await yt.findVideos(interaction.options.getString('query'), 1), requestedPosition = interaction.options.getInteger('position');

		if (requestedPosition < 0 || player.queueLength < requestedPosition)
			throw new UserError('Invalid position requested!');

		if (results.videos) {
			/**
			 * @type {import('../index').PlaylistResult}
			 */
			const result = results;
			const position = await player.addToQueue(result.videos, requestedPosition);

			return new Response({
				title: `<:check:1017933557412417586> Playlist has been added to the queue [${result.videos.length + 1} video${result.videos.length + 1 === 1 ? '' : 's'}]! (#${position})`,
				message: `[${result.title}](${parse.getPlaylistURL(result.id)}) by **${result.author}**`,
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
			/**
			 * @type {import('../index').QueueVideo}
			 */
			const result = results;
			const position = await player.addToQueue([ result ], requestedPosition);

			return new Response({
				title: position === 0 ? 'Now playing!' : `<:check:1017933557412417586> Video has been added to the queue! (#${position})`,
				message: `${models.formatVideo(result)}`,
				customFormatting: true,
				customEmbedProperties: {
					thumbnail: {
						url: parse.getVideoThubnailURL(result.id),
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
