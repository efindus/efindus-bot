const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

module.exports = new Command({
	name: 'resume',
	description: 'Resume the video.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.nowPlaying === null)
			throw new UserError('Nothing is currently playing!');

		if (!player.isPaused)
			throw new UserError('The video isn\'t paused!');

		if (!player.resume())
			throw new UserError('Failed to resume the video!');

		return new Response({
			message: 'Resumed the video!',
		});
	},
});
