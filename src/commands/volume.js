const { ApplicationCommandOptionType } = require('discord.js');

const { Command, Response } = require('../structures/Command');

module.exports = new Command({
	name: 'volume',
	description: 'Change the volume.',
	options: [
		{
			name: 'volume',
			type: ApplicationCommandOptionType.Integer,
			description: 'New volume.',
			required: false,
		},
	],
	voiceRequirements: 2,
	run: async ({ interaction, player }) => {
		const newVolume = interaction.options.getInteger('volume');

		if (newVolume !== null)
			player.volume = newVolume;

		return new Response({
			customFormatting: true,
			message: `**Volume:**\n[${'▬'.repeat(Math.round((player.volume / 100) * 5))}](https://youtu.be/dQw4w9WgXcQ)${'▬'.repeat(10 - Math.round((player.volume / 100) * 5))} \`${player.volume}%\``,
		});
	},
});
