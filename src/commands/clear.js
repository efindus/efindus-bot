const { UserError } = require('../utils/errors');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'clear',
	description: 'Clear the queue.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.queueLength === 0)
			throw new UserError('The queue is empty!');
		else
			player.clearQueue();

		return new Response({
			message: 'Cleared the queue!',
		});
	},
});
