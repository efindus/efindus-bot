require('dotenv').config();
require('./utils/array.util');
const parse = require('./utils/parse.util');
const models = require('./utils/models.util');
const { Client } = require('discord.js');
const { entersState, joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const ytsr = require('ytsr');
const ytpl = require('ytpl');
const ytsearch = require('youtube-sr').default;
const download = require('youtube-dl-exec').exec;

/*
 * ROADMAP:
 * make Player class with all the functionality thats scattered around this file and add some WS error handling from https://github.com/discordjs/discord.js/blob/main/packages/voice/examples/music-bot/src/music/subscription.ts
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
		'GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_VOICE_STATES',
	],
	ws: {
		properties: {
			$browser: 'Discord iOS',
		},
	},
});

client.on('ready', () => {
	client.application.commands.set([
		{
			name: 'play',
			description: 'Add a video to the queue.',
			options: [
				{
					name: 'query',
					type: 'STRING',
					description: 'Video\'s title.',
					required: true,
				}, {
					name: 'position',
					type: 'INTEGER',
					description: 'Index in the queue before which the video is going to be added. 0 will replace currently played one.',
					required: false,
				},
			],
		}, {
			name: 'skip',
			description: 'Skip a video.',
			options: [
				{
					name: 'position',
					type: 'INTEGER',
					description: 'Video\'s position in the queue.',
					required: false,
				}, {
					name: 'amount',
					type: 'INTEGER',
					description: 'Amount of videos to remove.',
					required: false,
				},
			],
		}, {
			name: 'queue',
			description: 'Display the queue.',
			options: [
				{
					name: 'page',
					type: 'INTEGER',
					description: 'Number of page in queue to show.',
					required: false,
				},
			],
		}, {
			name: 'clear',
			description: 'Clear the queue.',
		}, {
			name: 'leave',
			description: 'Leave the voice channel.',
		}, {
			name: 'search',
			description: 'Search a video on YouTube and add it to the queue.',
			options: [
				{
					name: 'query',
					type: 'STRING',
					description: 'Video\'s title.',
					required: true,
				},
			],
		}, {
			name: 'pause',
			description: 'Pause the video.',
		}, {
			name: 'resume',
			description: 'Resume the video.',
		}, {
			name: 'loop',
			description: 'Loop the video or the queue.',
			options: [
				{
					name: 'type',
					type: 'STRING',
					description: 'Loop type (defaults to video)',
					required: false,
					choices: [
						{
							name: 'disable',
							value: 'none',
						}, {
							name: 'queue',
							value: 'queue',
						}, {
							name: 'video',
							value: 'single',
						},
					],
				},
			],
		}, {
			name: 'volume',
			description: 'Change the volume.',
			options: [
				{
					name: 'volume',
					type: 'INTEGER',
					description: 'New volume.',
					required: false,
				},
			],
		}, {
			name: 'shuffle',
			description: 'Shuffle the queue.',
		}, {
			name: 'delayautoleave',
			description: 'Add 5 minutes to the autoleave timer. Only one-time use.',
		},
	]);

	client.user.setActivity({
		type: 'PLAYING',
		name: 'with slash commands!',
	});

	console.log(`\x1b[37m\x1b[42mREADY\x1b[0m ${client.user.tag} is ready!`);
});

/**
 * @type {Object.<string, import('./index').PlayerObject>}
 */
const players = {};

/**
 * Connect to a voice channel.
 * @param {import('discord.js').Interaction} interaction - User's interaction.
 */
const connectToChannel = async (interaction) => {
	if (!interaction.member.voice.channel) {
		// Problem Exists Between Keyboard And Chair
		throw new Error('PEBKAC:You\'re not connected to any voice channel on this server.');
	}

	if (!interaction.member.voice.channel.joinable) throw new Error('PEBKAC:I don\'t have sufficient permissions to join this voice channel!');

	if (!interaction.guild.me.voice.channel || !players[interaction.guild.id]) {
		const connection = await joinVoiceChannel({
			channelId: interaction.member.voice.channelId,
			guildId: interaction.guildId,
			adapterCreator: interaction.guild.voiceAdapterCreator,
		});

		if (players[interaction.guild.id]) return;

		players[interaction.guild.id] = {
			nowPlaying: null,
			queue: [],
			loopType: 0,
			volume: 1,
			player: createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Pause,
				},
			}),
			connection,
			channelId: interaction.member.voice.channelId,
			leaving: false,
			autoleaveTimeout: null,
			delayedAutoleave: 0,
			creationTS: Date.now(),
		};

		// players[interaction.guild.id].player.on('error', error => {
		// 	console.log(error);
		// });

		try {
			await entersState(connection, VoiceConnectionStatus.Ready, 20000);
			connection.subscribe(players[interaction.guild.id].player);
		} catch {
			throw new Error('Failed to join the voice channel within 20 seconds. Please try again later.');
		}
	} else if (interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
		throw new Error(`PEBKAC:You're not connected to <#${interaction.guild.me.voice.channelId}>`);
	}
};

/**
 * Check if user is connected to the channel.
 * @param {import('discord.js').Interaction} interaction - User's interaction.
 * @param {boolean} weak - Allow users not connected to the VC
 */
const checkConnection = (interaction, weak = false) => {
	if (!interaction.guild.me.voice.channel || !players[interaction.guild.id]) {
		throw new Error('PEBKAC:I\'m not connected to any voice channel on this server.');
	}

	if (!weak && interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
		throw new Error(`PEBKAC:You're not connected to <#${interaction.guild.me.voice.channelId}>`);
	}
};

/**
 * Add a video to the queue.
 * @param {import('./index').QueueVideo[]} videos - The video.
 * @param {string} guildId - Guild's id.
 * @param {number} requestedPosition - Position to put new videos at.
 */
const addToQueue = async (videos, guildId, requestedPosition = null) => {
	let queueIndex = players[guildId].queue.length + 1;
	if (requestedPosition === null) players[guildId].queue.push(...videos);
	else if (requestedPosition === 0) {
		players[guildId].player.stop();
		players[guildId].nowPlaying = null;
		players[guildId].queue.splice(0, 0, ...videos);
	} else players[guildId].queue.splice(requestedPosition - 1, 0, ...videos), queueIndex = requestedPosition;

	if (!players[guildId].nowPlaying) {
		await play(guildId);
		queueIndex = 0;
	}

	return queueIndex;
};

/**
 * Find videos.
 * @param {string} title - Video's title.
 * @param {number} limit - Number of videos to find.
 * @returns {Promise<import('./index').PlaylistResult | import('./index').QueueVideo | import('./index').QueueVideo[]>} Videos.
 */
const findVideos = async (query, limit) => {
	let url = query.trim(), playlist = false;

	const videoID = parse.getVideoID(url);
	if (videoID) url = parse.getVideoURL(videoID);
	else if (url.startsWith('https://www.youtube.com/')) playlist = true;
	else {
		url = (await ytsr.getFilters(url)).get('Type').get('Video').url;

		if (!url) throw new Error('PEBKAC:Video could not be found.');
	}

	if (playlist && limit === 1) {
		try {
			return parse.getPlaylistResult(await ytpl(url, { limit: 200 }));
		} catch (error) {
			throw new Error('PEBKAC:Unknown playlist!');
		}
	} else {
		if (limit !== 1 || url.startsWith('https://www.youtube.com/results')) {
			const results = await ytsr(url, { limit: limit });
			if (results.items.length === 0) throw new Error('PEBKAC:Video could not be found.');

			return limit === 1 ? parse.getQueueVideo(results.items[0]) : results.items.map(item => parse.getQueueVideo(item));
		} else {
			return parse.getQueueVideo(await ytsearch.getVideo(url));
		}
	}
};

const play = async (guildId) => {
	if (players[guildId].nowPlaying || players[guildId].queue.length === 0) return;

	players[guildId].nowPlaying = players[guildId].queue.shift();

	// FIXME: When video has multiple audio tracks it selects some non original one (for now that's only a problem when watching mrbeast's videos)
	const stream = download(parse.getVideoURL(players[guildId].nowPlaying.id), {
		o: '-',
		q: '',
		f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
		r: '100K',
	}, { stdio: ['ignore', 'pipe', 'ignore'] });

	players[guildId].resource = createAudioResource(stream.stdout, { inlineVolume: true });

	players[guildId].resource.playStream.on('end', () => {
		if (players[guildId].loopType === 1) players[guildId].queue.splice(0, 0, players[guildId].nowPlaying);
		else if (players[guildId].loopType === 2) players[guildId].queue.push(players[guildId].nowPlaying);

		players[guildId].nowPlaying = null;
		players[guildId].resource = null;
		play(guildId);
	});

	players[guildId].resource.playStream.on('error', (err) => {
		console.log(err);
	});

	players[guildId].resource.volume.setVolume(players[guildId].volume);
	players[guildId].player.play(players[guildId].resource);
};

const leave = (interaction) => {
	players[interaction.guild.id].leaving = true;
	players[interaction.guild.id].player?.stop();
	players[interaction.guild.id].connection?.destroy();
	delete players[interaction.guild.id];
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

		if (interaction.isCommand()) {
			await interaction.deferReply();
			switch (interaction.commandName) {
				case 'play': {
					await connectToChannel(interaction);

					const results = await findVideos(interaction.options.getString('query'), 1), requestedPosition = interaction.options.getInteger('position');
					checkConnection(interaction);

					if (requestedPosition < 0 || requestedPosition > players[interaction.guild.id].queue.length) throw new Error('PEBKAC:Invalid position requested!');
					if (results.videos) {
						/**
						 * @type {import('./index').PlaylistResult}
						 */
						const result = results;
						const position = await addToQueue(result.videos, interaction.guild.id, requestedPosition);

						response.customFormatting = true;
						response.title = `<:check:537885340304932875> Playlist has been added to the queue [${result.videos.length + 1} video${result.videos.length + 1 === 1 ? '' : 's'}]! (#${position})`;
						response.message = `[${result.title}](${parse.getPlaylistURL(result.id)}) by **${result.author}**`;
						response.customEmbedProperties = {
							thumbnail: {
								url: result.thumbnailURL,
							},
							footer: {
								iconURL: interaction.member.displayAvatarURL(),
								text: `🔉 ${Math.round(players[interaction.guild.id].volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
							},
						};
					} else {
						/**
						 * @type {import('./index').QueueVideo}
						 */
						const result = results;
						const position = await addToQueue([result], interaction.guild.id, requestedPosition);

						response.customFormatting = true;
						response.title = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
						response.message = `${models.formatVideo(result)}`;
						response.customEmbedProperties = {
							thumbnail: {
								url: parse.getVideoThubnailURL(result.id),
							},
							footer: {
								iconURL: interaction.member.displayAvatarURL(),
								text: `🔉 ${Math.round(players[interaction.guild.id].volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
							},
						};
					}

					break;
				}

				case 'search': {
					await connectToChannel(interaction);

					/**
					 * @type {import('./index').QueueVideo[]}
					 */
					const results = await findVideos(interaction.options.getString('query'), 10);

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
								type: 'ACTION_ROW',
								components: [
									{
										type: 'SELECT_MENU',
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

					if (index === null || index === 0) {
						if (players[interaction.guild.id].queue.length === 0 && players[interaction.guild.id].nowPlaying === null) {
							throw new Error('PEBKAC:Nothing is currently playing!');
						} else {
							players[interaction.guild.id].player.stop();
							const removed = players[interaction.guild.id].nowPlaying;
							players[interaction.guild.id].nowPlaying = null;

							if (amount > 0) players[interaction.guild.id].queue.splice(0, amount - 1);
							await play(interaction.guild.id);

							response.customFormatting = true;
							response.message = `<:check:537885340304932875> ${models.formatVideo(removed)} ${amount > 1 ? `and ${amount - 1} more video${amount - 1 === 1 ? '' : 's'} have` : 'has'} been skipped!`;
						}
					} else {
						const queue = players[interaction.guild.id].queue;
						if (queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
						else if (queue.length < index || index < 0) throw new Error('PEBKAC:Invalid index!');
						else {
							const removed = queue.splice(index - 1, amount)[0];
							response.customFormatting = true;
							response.message = `<:check:537885340304932875> ${models.formatVideo(removed)} ${amount > 1 ? `and ${amount - 1} more video${amount - 1 === 1 ? '' : 's'} have` : 'has'} been skipped!`;
						}
					}

					break;
				}

				case 'queue': {
					checkConnection(interaction, true);
					const pageIndex = (interaction.options.getInteger('page') ?? 1) - 1;
					if (pageIndex < 0 || pageIndex > Math.floor(players[interaction.guild.id].queue.length / 10)) throw new Error('PEBKAC:Invalid page number!');
					const { formattedQueue } = models.formatQueue(players[interaction.guild.id], pageIndex);
					if (formattedQueue.length === 0) throw new Error('PEBKAC:Nothing is currently playing!');

					response.customFormatting = true;
					response.message = formattedQueue;
					response.customProperties = {
						components: [
							{
								type: 'ACTION_ROW',
								components: [
									{
										type: 'BUTTON',
										customId: `queue-left-${players[interaction.guild.id].creationTS}-${pageIndex}`,
										label: '<',
										style: 'PRIMARY',
									}, {
										type: 'BUTTON',
										customId: `queue-right-${players[interaction.guild.id].creationTS}-${pageIndex}`,
										label: '>',
										style: 'PRIMARY',
									},
								],
							},
						],
					};
					response.customEmbedProperties = {
						footer: {
							iconURL: interaction.member.displayAvatarURL(),
							text: `Page ${pageIndex + 1}/${Math.floor(players[interaction.guild.id].queue.length / 10) + 1}`,
						},
					};

					break;
				}

				case 'clear': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
					else {
						player.queue = [];
						response.message = 'Cleared the queue!';
					}
					break;
				}

				case 'shuffle': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
					else {
						player.queue.shuffle();
						response.message = 'Shuffled the queue!';
					}
					break;
				}

				case 'loop': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

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
					leave(interaction);

					response.message = 'Successfully left the voice channel!';
					break;
				}

				case 'pause': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.nowPlaying === null) throw new Error('PEBKAC:Nothing is currently playing!');

					if (player.player.state.status === AudioPlayerStatus.Paused) throw new Error('PEBKAC:The video is already paused!');

					if (player.player.pause()) response.message = 'Paused the video!';
					else throw new Error('PEBKAC:Failed to pause the video!');

					break;
				}

				case 'resume': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.nowPlaying === null) throw new Error('PEBKAC:Nothing is currently playing!');

					if (player.player.state.status !== AudioPlayerStatus.Paused) throw new Error('PEBKAC:The video isn\'t paused!');

					if (player.player.unpause()) response.message = 'Resumed the video!';
					else throw new Error('PEBKAC:Failed to resume the video!');

					break;
				}

				case 'volume': {
					checkConnection(interaction);
					const player = players[interaction.guild.id], newVolume = interaction.options.getInteger('volume');

					if (newVolume !== null) {
						if (newVolume < 0 || newVolume > 200) throw new Error('PEBKAC:Invalid volume! Available range: 0-200%');
						player.volume = newVolume / 100;
						if (player.resource !== null) player.resource.volume.setVolume(player.volume);
					}

					response.customFormatting = true;
					response.message = `**Volume:**\n[${'▬'.repeat(Math.round(player.volume * 5))}](https://youtu.be/dQw4w9WgXcQ)${'▬'.repeat(10 - Math.round(player.volume * 5))} \`${player.volume * 100}%\``;

					break;
				}

				case 'delayautoleave': {
					const player = players[interaction.guild.id];

					if (!player) checkConnection(interaction);

					if (player.autoleaveTimeout === null) {
						checkConnection(interaction);
						throw new Error('PEBKAC:I\'m not currently autoleaving!');
					}

					if (player.delayedAutoleave !== 0) throw new Error('PEBKAC:Autoleave was already delayed!');
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
			await interaction.deferReply();
			switch (interaction.customId) {
				case 'search': {
					await connectToChannel(interaction);

					/**
					 * @type {import('./index').QueueVideo}
					 */
					const result = (await findVideos(interaction.values[0], 1));
					checkConnection(interaction);
					const position = await addToQueue([result], interaction.guild.id);

					response.customFormatting = true;
					response.title = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
					response.message = `${models.formatVideo(result)}`;
					response.customEmbedProperties = {
						thumbnail: {
							url: parse.getVideoThubnailURL(result.id),
						},
						footer: {
							iconURL: interaction.member.displayAvatarURL(),
							text: `🔉 ${Math.round(players[interaction.guild.id].volume * 100)}% • Requested by: ${interaction.member.user.tag}`,
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
			await interaction.deferUpdate();

			const tokens = interaction.customId.split('-');
			switch (tokens[0]) {
				case 'queue': {
					if (!players[interaction.guild.id]) return;
					if (+tokens[2] !== players[interaction.guild.id].creationTS) return;
					let generatedQueue;
					if (tokens[1] === 'left') {
						generatedQueue = models.formatQueue(players[interaction.guild.id], +tokens[3] - 1);
					} else {
						generatedQueue = models.formatQueue(players[interaction.guild.id], +tokens[3] + 1);
					}
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
									text: `Page ${generatedQueue.pageIndex + 1}/${Math.floor(players[interaction.guild.id].queue.length / 10) + 1}`,
								},
							},
						],
						components: [
							{
								type: 'ACTION_ROW',
								components: [
									{
										type: 'BUTTON',
										customId: `queue-left-${players[interaction.guild.id].creationTS}-${generatedQueue.pageIndex}`,
										label: '<',
										style: 'PRIMARY',
									}, {
										type: 'BUTTON',
										customId: `queue-right-${players[interaction.guild.id].creationTS}-${generatedQueue.pageIndex}`,
										label: '>',
										style: 'PRIMARY',
									},
								],
							},
						],
					});
					break;
				}

				default: {
					break;
				}
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
		if (!error.message || !error.message.startsWith('PEBKAC:')) console.log(error);
		else error.message = error.message.replace('PEBKAC:', '');

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

client.on('voiceStateUpdate', async (oldState, newState) => {
	if (oldState.id === client.user.id) {
		if (newState.channelId && players[oldState.guild.id]) players[oldState.guild.id].channelId = newState.channelId;
		else {
			if (players[oldState.guild.id] && !players[oldState.guild.id].leaving) leave(oldState);
			return;
		}
	}

	const player = players[oldState.guild.id];
	if (!player) return;
	if (player.channelId === oldState.channelId || player.channelId === newState.channelId) {
		if ((await client.channels.fetch(player.channelId)).members.size === 1) {
			if (player.autoleaveTimeout !== null) clearTimeout(player.autoleaveTimeout);

			player.delayedAutoleave = 0;
			const autoleave = async () => {
				const player = players[oldState.guild.id];
				if (!player) return;
				if (player.delayedAutoleave === 1) {
					player.delayedAutoleave = 2;
					setTimeout(autoleave, 5 * 60 * 1000);
				} else leave(oldState);
			};
			player.autoleaveTimeout = setTimeout(autoleave, 30 * 1000);
		} else if (player.autoleaveTimeout !== null) {
			clearTimeout(player.autoleaveTimeout);
			player.autoleaveTimeout = null;
		}
	}
});

process.on('uncaughtException', error => {
	console.log(error);
});

process.on('unhandledRejection', error => {
	console.log(error);
});

client.login(process.env.TOKEN);
