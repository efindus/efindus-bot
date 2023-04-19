const { Command, Response, ResponseError } = require('../structures/Command');

module.exports = new Command({
	name: 'delayautoleave',
	description: 'Add 5 minutes to the autoleave timer. Only one-time use.',
	voiceRequirements: 0,
	run: async ({ player }) => {
		if (!player)
			throw new ResponseError('I\'m not connected to any voice channel on this server.');

		player.delayAutoleave();

		return new Response({
			message: 'I\'ll stay in the voice channel alone 5 minutes longer. (sad lonely bot noises)',
		});
	},
});
