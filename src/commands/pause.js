const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

module.exports = new Command({
	name: 'pause',
	description: 'Pause the video.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.nowPlaying === null)
			throw new UserError('Nothing is currently playing!');

		if (player.isPaused)
			throw new UserError('The video is already paused!');

		if (!player.pause())
			throw new UserError('Failed to pause the video!');

		return new Response({
			message: 'Paused the video!',
		});
	},
});
