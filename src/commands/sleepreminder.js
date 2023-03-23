const { UserError } = require('../utils/errors');
const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'sleepreminder',
	description: 'Get annoying reminders that tell you to go to bed.',
	run: async ({ bot, interaction }) => {


		// return new Response({
		// 	message: 'Shuffled the queue!',
		// });
	},
});
