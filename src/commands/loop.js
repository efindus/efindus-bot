const { ApplicationCommandOptionType } = require('discord.js');

const { Command, Response } = require('../modules/command');

module.exports = new Command({
	name: 'loop',
	description: 'Loop the video or the queue.',
	options: [
		{
			name: 'type',
			type: ApplicationCommandOptionType.String,
			description: 'Loop type (defaults to video)',
			required: false,
			choices: [
				{
					name: 'disable',
					value: 'none',
				},
				{
					name: 'queue',
					value: 'queue',
				},
				{
					name: 'video',
					value: 'single',
				},
			],
		},
	],
	voiceRequirements: 2,
	run: async ({ interaction, player }) => {
		let message;
		switch (interaction.options.getString('type')) {
			case 'none': {
				player.loopType = 0;
				message = 'Disabled loop!';
				break;
			}

			case 'queue': {
				player.loopType = 2;
				message = 'Enabled queue looping!';
				break;
			}

			default: {
				player.loopType = 1;
				message = 'Enabled video looping!';
				break;
			}
		}

		return new Response({
			message,
		});
	},
});
