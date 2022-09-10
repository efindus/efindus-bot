const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

module.exports = new Command({
	name: 'clear',
	description: 'Clear the queue.',
	voiceRequirements: 2,
	run: async (bot, interaction) => {
		const player = bot.playerManager.getPlayer(interaction.guild.id);
		if (player.queueLength === 0)
			throw new UserError('The queue is empty!');
		else
			player.clearQueue();

		return new Response({
			message: 'Cleared the queue!',
		});
	},
});
