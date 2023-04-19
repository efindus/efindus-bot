const { Command, Response, ResponseError } = require('../structures/Command');

module.exports = new Command({
	name: 'resume',
	description: 'Resume the video.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.nowPlaying === null)
			throw new ResponseError('Nothing is currently playing!');

		if (!player.isPaused)
			throw new ResponseError('The video isn\'t paused!');

		if (!player.resume())
			throw new ResponseError('Failed to resume the video!');

		return new Response({
			message: 'Resumed the video!',
		});
	},
});
