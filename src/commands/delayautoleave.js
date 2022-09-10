const { UserError } = require('../utils/errors');
const { Command, Response } = require('../modules/command');

module.exports = new Command({
	name: 'delayautoleave',
	description: 'Add 5 minutes to the autoleave timer. Only one-time use.',
	voiceRequirements: 0,
	run: async (bot, interaction) => {
		const player = bot.playerManager.getPlayer(interaction.guild.id);
		if (!player)
			throw new UserError('I\'m not connected to any voice channel on this server.');

		player.delayAutoleave();

		return new Response({
			message: 'I\'ll stay in the voice channel alone 5 minutes longer. (sad lonely bot noises)',
		});
	},
});
