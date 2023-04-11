const { UserError } = require('../utils/errorHandler');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'shuffle',
	description: 'Shuffle the queue.',
	voiceRequirements: 2,
	run: async ({ player }) => {
		if (player.queueLength === 0)
			throw new UserError('The queue is empty!');
		else
			player.shuffleQueue();

		return new Response({
			message: 'Shuffled the queue!',
		});
	},
});
