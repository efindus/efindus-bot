const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'leave',
	description: 'Leave the voice channel.',
	voiceRequirements: 2,
	run: async ({ bot, interaction }) => {
		bot.playerManager.leave(interaction.guild.id);

		return new Response({
			message: 'Successfully left the voice channel!',
		});
	},
});
