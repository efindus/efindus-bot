const { Command, Response, ResponseError } = require('../structures/Command');

module.exports = new Command({
	name: 'pause',
	description: 'Pause the video.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.nowPlaying === null)
			throw new ResponseError('Nothing is currently playing!');

		if (player.isPaused)
			throw new ResponseError('The video is already paused!');

		if (!player.pause())
			throw new ResponseError('Failed to pause the video!');

		return new Response({
			message: 'Paused the video!',
		});
	},
});
