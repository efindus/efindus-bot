require('dotenv').config();
const { Client, GatewayIntentBits, ApplicationCommandOptionType, ActivityType, ComponentType, ButtonStyle } = require('discord.js');

require('./utils/array');
const parse = require('./utils/parse');
const models = require('./utils/models');
const yt = require('./utils/youtube');
const { logger } = require('./utils/logger');
const { PlayerManager } = require('./modules/playermanager');
const { UserError } = require('./utils/errors');

// FIXME: fix queue showing extra empty page when there are eg. 10 videos
// FIXME: try using @discordjs/opus instead of opusscript
// FIXME: autoleave (https://discord.com/channels/640088902526566400/756621847151378432/1017203654450753577)

/*
 * ROADMAP:
 * turn this into a full-fledged bot:
 * - make a command handler that will load commands from files in commands/
 * - add embed models into models.js
 * - rename the bot into NeverFindusBoT or sth else if I come up with anything
 * - return to FindusBoT's version number, so the version at this point will be 4.0.1-beta, also at this point I should make an anounement on findus-news and add a readme.md and license (GPL-3)
 * show duration in more places (and make queue total duration)
 * think about making a /djcontrols command which would allow to perform various actions using buttons and selection menus (pause, resume, loop control etc)
 * start utilizing the footer (like in the old play), after this rename old newFindusBot repo into NeverFindusBoT and switch to using that as a remote
 * implement seek (mainly as a functionality to power filters)
 * add /dev command (for now just /dev eval and /dev help), responses should be ephemeral and the command should only have one argument (a string) as it will be visible to everyone due to the way slash commands work
 * add filters (from here: https://github.com/Androz2091/discord-player/blob/master/src/utils/AudioFilters.ts)
 * aim for version 4.1.0 here
 * more dev commands and random utility ones like poll, rng etc.
 * 4.2.0 here
 * soundcloud support
 * 4.3.0 here
 * (reminder for the future) bump version
 * https://github.com/discordjs/discord.js/blob/main/packages/voice/examples/music-bot/src/music
 */

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates,
	],
	ws: {
		properties: {
			browser: 'Discord Android',
		},
	},
});

const playerManager = new PlayerManager(client);

client.on('ready', () => {
	client.application.commands.set([
		{
			name: 'play',
			description: 'Add a video to the queue.',
			dmPermission: false,
			options: [
				{
					name: 'query',
					type: ApplicationCommandOptionType.String,
					description: 'Video\'s title.',
					required: true,
				},
				{
					name: 'position',
					type: ApplicationCommandOptionType.Integer,
					description: 'Index in the queue before which the video is going to be added. 0 will replace currently played one.',
					required: false,
				},
			],
		},
		{
			name: 'skip',
			description: 'Skip a video.',
			dmPermission: false,
			options: [
				{
					name: 'position',
					type: ApplicationCommandOptionType.Integer,
					description: 'Video\'s position in the queue.',
					required: false,
				},
				{
					name: 'amount',
					type: ApplicationCommandOptionType.Integer,
					description: 'Amount of videos to remove.',
					required: false,
				},
			],
		},
		{
			name: 'queue',
			description: 'Display the queue.',
			dmPermission: false,
			options: [
				{
					name: 'page',
					type: ApplicationCommandOptionType.Integer,
					description: 'Number of page in queue to show.',
					required: false,
				},
			],
		},
		{
			name: 'clear',
			description: 'Clear the queue.',
			dmPermission: false,
		},
		{
			name: 'leave',
			description: 'Leave the voice channel.',
			dmPermission: false,
		},
		{
			name: 'search',
			description: 'Search a video on YouTube and add it to the queue.',
			dmPermission: false,
			options: [
				{
					name: 'query',
					type: ApplicationCommandOptionType.String,
					description: 'Video\'s title.',
					required: true,
				},
			],
		},
		{
			name: 'pause',
			dmPermission: false,
			description: 'Pause the video.',
		},
		{
			name: 'resume',
			dmPermission: false,
			description: 'Resume the video.',
		},
		{
			name: 'loop',
			description: 'Loop the video or the queue.',
			dmPermission: false,
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
		},
		{
			name: 'volume',
			description: 'Change the volume.',
			dmPermission: false,
			options: [
				{
					name: 'volume',
					type: ApplicationCommandOptionType.Integer,
					description: 'New volume.',
					required: false,
				},
			],
		},
		{
			name: 'shuffle',
			description: 'Shuffle the queue.',
			dmPermission: false,
		},
		{
			name: 'delayautoleave',
			description: 'Add 5 minutes to the autoleave timer. Only one-time use.',
			dmPermission: false,
		},
	]);

	client.user.setActivity({
		type: ActivityType.Playing,
		name: 'with slash commands!',
	});

	logger.ready(`${client.user.tag} is ready!`);
});

/**
 * Check if user is connected to the channel.
 * @param {import('discord.js').Interaction} interaction - User's interaction.
 * @param {boolean} weak - Allow users not connected to the VC
 */
const checkConnection = (interaction, weak = false) => {
	if (!interaction.guild.members.me.voice.channel || !playerManager.getPlayer(interaction.guild.id))
		throw new UserError('I\'m not connected to any voice channel on this server.');

	if (!weak && interaction.member.voice.channelId !== interaction.guild.members.me.voice.channelId)
		throw new UserError(`You're not connected to <#${interaction.guild.members.me.voice.channelId}>`);
};

client.on('interactionCreate', async (interaction) => {
	if (!interaction.guild) return;

	try {
		const response = {
			title: '',
			message: '',
			customProperties: {},
			customFormatting: false,
			customEmbedProperties: {},
		};

		if (interaction.isButton())
			await interaction.deferUpdate();
		else
			await interaction.deferReply();

		const player = await playerManager.connect(interaction.member);
		if (interaction.isCommand()) {
			switch (interaction.commandName) {
				case 'play': {
					const results = await yt.findVideos(interaction.options.getString('query'), 1), requestedPosition = interaction.options.getInteger('position');
					checkConnection(interaction);

					if (requestedPosition < 0 || player.queueLength < requestedPosition)
						throw new UserError('Invalid position requested!');

					if (results.videos) {
						/**
						 * @type {import('./index').PlaylistResult}
						 */
						const result = results;
						const position = await player.addToQueue(result.videos, requestedPosition);

						response.customFormatting = true;
						response.title = `<:check:537885340304932875> Playlist has been added to the queue [${result.videos.length + 1} video${result.videos.length + 1 === 1 ? '' : 's'}]! (#${position})`;
						response.message = `[${result.title}](${parse.getPlaylistURL(result.id)}) by **${result.author}**`;
						response.customEmbedProperties = {
							thumbnail: {
								url: result.thumbnailURL,
							},
							footer: {
								iconURL: interaction.member.displayAvatarURL(),
								text: `🔉 ${Math.round(player.volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
							},
						};
					} else {
						/**
						 * @type {import('./index').QueueVideo}
						 */
						const result = results;
						const position = await player.addToQueue([ result ], requestedPosition);

						response.customFormatting = true;
						response.title = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
						response.message = `${models.formatVideo(result)}`;
						response.customEmbedProperties = {
							thumbnail: {
								url: parse.getVideoThubnailURL(result.id),
							},
							footer: {
								iconURL: interaction.member.displayAvatarURL(),
								text: `🔉 ${Math.round(player.volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
							},
						};
					}

					break;
				}

				case 'search': {
					/**
					 * @type {import('./index').QueueVideo[]}
					 */
					const results = await yt.findVideos(interaction.options.getString('query'), 10);

					const videos = [];

					results.forEach((video) => {
						videos.push({
							label: video.title,
							description: video.author,
							value: parse.getVideoURL(video.id),
						});
					});

					response.customProperties = {
						content: '**Select a video:**',
						components: [
							{
								type: ComponentType.ActionRow,
								components: [
									{
										type: ComponentType.SelectMenu,
										customId: 'search',
										placeholder: 'Select a video',
										options: videos,
									},
								],
							},
						],
						ephemeral: true,
					};

					break;
				}

				case 'skip': {
					checkConnection(interaction);

					const index = interaction.options.getInteger('position'), amount = interaction.options.getInteger('amount') ?? 1;

					const removed = await player.skip(index, amount);
					response.customFormatting = true;
					response.message = `<:check:537885340304932875> ${models.formatVideo(removed[0])} ${removed.length > 1 ? `and ${removed.length - 1} more video${removed.length - 1 === 1 ? '' : 's'} have` : 'has'} been skipped!`;

					break;
				}

				case 'queue': {
					checkConnection(interaction, true);

					const pageIndex = (interaction.options.getInteger('page') ?? 1) - 1;
					if (pageIndex < 0 || Math.floor(player.queueLength / 10) < pageIndex)
						throw new UserError('Invalid page number!');

					const { formattedQueue } = models.formatQueue(player, pageIndex);
					if (formattedQueue.length === 0)
						throw new UserError('Nothing is currently playing!');

					response.customFormatting = true;
					response.message = formattedQueue;
					response.customProperties = {
						components: [
							{
								type: ComponentType.ActionRow,
								components: [
									{
										type: ComponentType.Button,
										customId: `queue-left-${player.creationTS}-${pageIndex}`,
										label: '<',
										style: ButtonStyle.Primary,
									},
									{
										type: ComponentType.Button,
										customId: `queue-right-${player.creationTS}-${pageIndex}`,
										label: '>',
										style: ButtonStyle.Primary,
									},
								],
							},
						],
					};
					response.customEmbedProperties = {
						footer: {
							iconURL: interaction.member.displayAvatarURL(),
							text: `Page ${pageIndex + 1}/${Math.floor(player.queueLength / 10) + 1}`,
						},
					};

					break;
				}

				case 'clear': {
					checkConnection(interaction);

					if (player.queueLength === 0) {
						throw new UserError('The queue is empty!');
					} else {
						player.clearQueue();
						response.message = 'Cleared the queue!';
					}

					break;
				}

				case 'shuffle': {
					checkConnection(interaction);

					if (player.queueLength === 0) {
						throw new UserError('The queue is empty!');
					} else {
						player.shuffleQueue();
						response.message = 'Shuffled the queue!';
					}

					break;
				}

				case 'loop': {
					checkConnection(interaction);

					switch (interaction.options.getString('type')) {
						case 'none': {
							player.loopType = 0;
							response.message = 'Disabled loop!';
							break;
						}

						case 'queue': {
							player.loopType = 2;
							response.message = 'Enabled queue looping!';
							break;
						}

						default: {
							player.loopType = 1;
							response.message = 'Enabled video looping!';
							break;
						}
					}

					break;
				}

				case 'leave': {
					checkConnection(interaction);

					playerManager.leave(interaction.guild.id);
					response.message = 'Successfully left the voice channel!';

					break;
				}

				case 'pause': {
					checkConnection(interaction);

					if (player.nowPlaying === null)
						throw new UserError('Nothing is currently playing!');

					if (player.isPaused)
						throw new UserError('The video is already paused!');

					if (player.pause())
						response.message = 'Paused the video!';
					else
						throw new UserError('Failed to pause the video!');

					break;
				}

				case 'resume': {
					checkConnection(interaction);

					if (player.nowPlaying === null)
						throw new UserError('Nothing is currently playing!');

					if (!player.isPaused)
						throw new UserError('The video isn\'t paused!');

					if (player.resume())
						response.message = 'Resumed the video!';
					else
						throw new UserError('Failed to resume the video!');

					break;
				}

				case 'volume': {
					checkConnection(interaction);
					const newVolume = interaction.options.getInteger('volume');

					if (newVolume !== null) {
						if (newVolume < 0 || 200 < newVolume)
							throw new UserError('Invalid volume! Available range: 0-200%');

						player.setVolume(newVolume / 100);
					}

					response.customFormatting = true;
					response.message = `**Volume:**\n[${'▬'.repeat(Math.round(player.volume * 5))}](https://youtu.be/dQw4w9WgXcQ)${'▬'.repeat(10 - Math.round(player.volume * 5))} \`${player.volume * 100}%\``;

					break;
				}

				case 'delayautoleave': {
					if (!player)
						checkConnection(interaction);

					if (player.autoleaveTimeout === null) {
						checkConnection(interaction);
						throw new UserError('I\'m not currently autoleaving!');
					}

					if (player.delayedAutoleave !== 0)
						throw new UserError('Autoleave was already delayed!');

					player.delayedAutoleave = 1;
					response.message = 'I\'ll stay in the voice channel alone 5 minutes longer. (sad lonely bot noises)';

					break;
				}

				default: {
					interaction.editReply({
						embeds: [
							{
								title: 'Failed!',
								description: '<:cross:537885611865145367> This command isn\'t implemented yet.',
								color: 0xcf1d32,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
							},
						],
					});
				}
			}
		} else if (interaction.isSelectMenu()) {
			switch (interaction.customId) {
				case 'search': {
					/**
					 * @type {import('./index').QueueVideo}
					 */
					const result = await yt.findVideos(interaction.values[0], 1);
					checkConnection(interaction);

					const position = await player.addToQueue([ result ]);

					response.customFormatting = true;
					response.title = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
					response.message = `${models.formatVideo(result)}`;
					response.customEmbedProperties = {
						thumbnail: {
							url: parse.getVideoThubnailURL(result.id),
						},
						footer: {
							iconURL: interaction.member.displayAvatarURL(),
							text: `🔉 ${Math.round(player.volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
						},
					};

					break;
				}

				default: {
					interaction.editReply({
						embeds: [
							{
								title: 'Failed!',
								description: '<:cross:537885611865145367> This command isn\'t implemented yet.',
								color: 0xcf1d32,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
							},
						],
					});
				}
			}
		} else if (interaction.isButton()) {
			const tokens = interaction.customId.split('-');
			switch (tokens[0]) {
				case 'queue': {
					if (!player || +tokens[2] !== player.creationTS)
						return;

					let generatedQueue;
					if (tokens[1] === 'left')
						generatedQueue = models.formatQueue(player, +tokens[3] - 1);
					else
						generatedQueue = models.formatQueue(player, +tokens[3] + 1);

					await interaction.editReply({
						embeds: [
							{
								description: generatedQueue.formattedQueue,
								color: 0x249e43,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
								footer: {
									iconURL: interaction.member.displayAvatarURL(),
									text: `Page ${generatedQueue.pageIndex + 1}/${Math.floor(player.queue.length / 10) + 1}`,
								},
							},
						],
						components: [
							{
								type: ComponentType.ActionRow,
								components: [
									{
										type: ComponentType.Button,
										customId: `queue-left-${player.creationTS}-${generatedQueue.pageIndex}`,
										label: '<',
										style: ButtonStyle.Primary,
									},
									{
										type: ComponentType.Button,
										customId: `queue-right-${player.creationTS}-${generatedQueue.pageIndex}`,
										label: '>',
										style: ButtonStyle.Primary,
									},
								],
							},
						],
					});

					break;
				}

				default: break;
			}

			return;
		}

		if (response.customProperties.ephemeral) {
			await interaction.deleteReply();
			interaction.followUp({
				...response.customProperties,
			});
		} else {
			interaction.editReply({
				embeds: [
					{
						title: response.title,
						description: response.message.length !== 0 ? (response.customFormatting ? response.message : `<:check:537885340304932875> **${response.message}**`) : null,
						color: 0x249e43,
						author: {
							name: client.user.username,
							iconURL: client.user.displayAvatarURL(),
						},
						...response.customEmbedProperties,
					},
				],
				...response.customProperties,
			});
		}
	} catch (error) {
		if (!(error instanceof UserError)) {
			logger.error(error.stack ?? error.message);
			error.message = 'An unexpected error occured. Please notify @Findus#7449';
		}

		interaction.editReply({
			embeds: [
				{
					description: `<:cross:537885611865145367> **${error.message}**`,
					color: 0xcf1d32,
					author: {
						name: client.user.username,
						iconURL: client.user.displayAvatarURL(),
					},
				},
			],
		});
	}
});

process.on('uncaughtException', error => {
	logger.error(error.stack ?? error.message);
});

process.on('unhandledRejection', error => {
	logger.error(error.stack ?? error.message);
});

client.login(process.env.TOKEN);
