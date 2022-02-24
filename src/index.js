require('dotenv').config();
require('./utils/array');
const parse = require('./utils/parse');
const { Client } = require('discord.js');
const { entersState, joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, VoiceConnectionStatus, AudioPlayerStatus } = require('@discordjs/voice');
const ytsr = require('ytsr');
const ytpl = require('ytpl');
const ytsearch = require('youtube-sr').default;
const download = require('youtube-dl-exec').exec;

// https://github.com/discordjs/voice/tree/main/examples/music-bot/src/music
/*
 * TODO:
 * scrollable queue
 * splay (playtop playskip and playindex in one command)
 * add filters (some)
 * maybe soundcloud support
 * turn this into a full-fledged bot (make a command handler and split this into files (make the player a class and put commands in separate files automagically loaded by a command handler) cuz 768 line js kinda sux and maybe rename the thing into sth else idk ~~maybe the NeverFindusBoT~~ ask marximimus about that)
 * (reminder for the future) bump version
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
					description: 'Index in the queue before which the video is going to be added. 0 will result in replacing currently played video.',
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
					required: true,
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
 * @param {import("discord.js").Interaction} interaction - User's interaction.
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
 * @param {import("discord.js").Interaction} interaction - User's interaction.
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
 */
const addToQueue = async (videos, guildId) => {
	let queueIndex = players[guildId].queue.length + 1;
	players[guildId].queue.push(...videos);

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

	const resource = createAudioResource(stream.stdout);

	resource.playStream.on('end', () => {
		if (players[guildId].loopType === 1) players[guildId].queue.splice(0, 0, players[guildId].nowPlaying);
		else if (players[guildId].loopType === 2) players[guildId].queue.push(players[guildId].nowPlaying);

		players[guildId].nowPlaying = null;
		play(guildId);
	});

	resource.playStream.on('error', (err) => {
		console.log(err);
	});

	players[guildId].player.play(resource);
};

const leave = (interaction) => {
	players[interaction.guild.id].leaving = true;
	players[interaction.guild.id].player?.stop();
	players[interaction.guild.id].connection?.destroy();
	delete players[interaction.guild.id];
};

client.on('interactionCreate', async (interaction) => {
	if (!interaction.guild) {
		return;
	}

	try {
		let responseTitle = '', responseMessage = '', responseProps = {}, responseCustomFormatting = false;
		await interaction.deferReply();

		if (interaction.isCommand()) {
			switch (interaction.commandName) {
				case 'play': {
					await connectToChannel(interaction);

					const results = await findVideos(interaction.options.getString('query'), 1);
					checkConnection(interaction);
					if (results.videos) {
						/**
						 * @type {import('./index').PlaylistResult}
						 */
						const result = results;
						const position = await addToQueue(result.videos, interaction.guild.id);

						responseCustomFormatting = true;
						responseTitle = `<:check:537885340304932875> Playlist has been added to the queue [${result.videos.length + 1} video${result.videos.length + 1 === 1 ? '' : 's'}]! (#${position})`;
						responseMessage = `[${result.title}](${parse.getPlaylistURL(result.id)}) by **${result.author}**`;
						responseProps = {
							thumbnail: {
								url: result.thumbnailURL,
							},
						};
					} else {
						/**
						 * @type {import('./index').QueueVideo}
						 */
						const result = results;
						const position = await addToQueue([result], interaction.guild.id);

						responseCustomFormatting = true;
						responseTitle = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
						responseMessage = `${parse.formatVideo(result)}`;
						responseProps = {
							thumbnail: {
								url: parse.getVideoThubnailURL(result.id),
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

					responseProps = {
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

					let index = -1, amount = 1;

					try {
						index = interaction.options.getInteger('position');
					} catch (error) {
						throw new Error('PEBKAC:Invalid index value!');
					}

					try {
						amount = interaction.options.getInteger('amount');
						if (amount === null) amount = 1;
					} catch (error) {
						throw new Error('PEBKAC:Invalid amount!');
					}

					if (index === null || index === 0) {
						if (players[interaction.guild.id].queue.length === 0 && players[interaction.guild.id].nowPlaying === null) {
							throw new Error('PEBKAC:Nothing is currently playing!');
						} else {
							players[interaction.guild.id].player.stop();
							const removed = players[interaction.guild.id].nowPlaying;
							players[interaction.guild.id].nowPlaying = null;

							amount--;
							if (amount > 0) players[interaction.guild.id].queue.splice(0, amount);
							await play(interaction.guild.id);

							responseCustomFormatting = true;
							responseMessage = `<:check:537885340304932875> ${parse.formatVideo(removed)} ${amount > 0 ? `and ${amount} more video${amount === 1 ? '' : 's'} have` : 'has'} been skipped!`;
						}
					} else {
						const queue = players[interaction.guild.id].queue;
						if (queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
						else if (queue.length < index || index < 0) throw new Error('PEBKAC:Invalid index!');
						else {
							const removed = queue.splice(index - 1, amount)[0];
							responseCustomFormatting = true;
							responseMessage = `<:check:537885340304932875> ${parse.formatVideo(removed)} ${amount > 1 ? `and ${amount - 1} more video${amount - 1 === 1 ? '' : 's'} have` : 'has'} been skipped!`;
						}
					}

					break;
				}

				case 'queue': {
					checkConnection(interaction, true);
					const player = players[interaction.guild.id];

					let formattedQueue = '';

					if (player.nowPlaying !== null) formattedQueue += `:play_pause: **Currently playing${player.loopType === 0 ? '' : ` [loop: ${player.loopType === 1 ? 'video' : 'queue'}]`}:**\n**[0]** ${parse.formatVideoWithProgress(player.nowPlaying, player.player.state.playbackDuration)}\n\n`;

					if (player.queue.length !== 0) {
						formattedQueue += `:notepad_spiral: **Current queue [${player.queue.length}]:**\n`;
						for (let i = 0; i < player.queue.length; i++) {
							formattedQueue += `**[${i + 1}]** ${parse.formatVideo(player.queue[i])}\n`;
						}
					}

					if (formattedQueue.length > 2000) {
						formattedQueue = formattedQueue.slice(0, 1997);
						formattedQueue += '...';
					} else if (formattedQueue.length === 0) throw new Error('PEBKAC:Nothing is currently playing!');

					responseCustomFormatting = true;
					responseMessage = formattedQueue;

					break;
				}

				case 'clear': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
					else {
						player.queue = [];
						responseMessage = 'Cleared the queue!';
					}
					break;
				}

				case 'shuffle': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) throw new Error('PEBKAC:The queue is empty!');
					else {
						player.queue.shuffle();
						responseMessage = 'Shuffled the queue!';
					}
					break;
				}

				case 'loop': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					let type;
					try {
						type = interaction.options.getString('type', false);
					} catch (error) {
						throw new Error('PEBKAC:Invalid loop type!');
					}

					switch (type) {
						case 'none': {
							player.loopType = 0;
							responseMessage = 'Disabled loop!';
							break;
						}

						case 'queue': {
							player.loopType = 2;
							responseMessage = 'Enabled queue looping!';
							break;
						}

						default: {
							player.loopType = 1;
							responseMessage = 'Enabled video looping!';
							break;
						}
					}

					break;
				}

				case 'leave': {
					checkConnection(interaction);
					leave(interaction);

					responseMessage = 'Successfully left the voice channel!';
					break;
				}

				case 'pause': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.nowPlaying === null) throw new Error('PEBKAC:Nothing is currently playing!');

					if (player.player.state.status === AudioPlayerStatus.Paused) throw new Error('PEBKAC:The video is already paused!');

					if (player.player.pause()) responseMessage = 'Paused the video!';
					else throw new Error('PEBKAC:Failed to pause the video!');

					break;
				}

				case 'resume': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.nowPlaying === null) throw new Error('PEBKAC:Nothing is currently playing!');

					if (player.player.state.status !== AudioPlayerStatus.Paused) throw new Error('PEBKAC:The video isn\'t paused!');

					if (player.player.unpause()) responseMessage = 'Resumed the video!';
					else throw new Error('PEBKAC:Failed to resume the video!');

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

					responseMessage = 'I\'ll stay in the voice channel alone 5 minutes longer. (sad lonely bot noises)';

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
					await connectToChannel(interaction);

					/**
					 * @type {import('./index').QueueVideo}
					 */
					const result = (await findVideos(interaction.values[0], 1));
					checkConnection(interaction);
					const position = await addToQueue([result], interaction.guild.id);

					responseCustomFormatting = true;
					responseTitle = position === 0 ? 'Now playing!' : `<:check:537885340304932875> Video has been added to the queue! (#${position})`;
					responseMessage = `${parse.formatVideo(result)}`;
					responseProps = {
						thumbnail: {
							url: parse.getVideoThubnailURL(result.id),
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
		}

		if (responseProps.content) {
			await interaction.deleteReply();
			interaction.followUp({
				...responseProps,
			});
		} else {
			interaction.editReply({
				embeds: [
					{
						title: responseTitle,
						description: responseMessage.length !== 0 ? (responseCustomFormatting ? responseMessage : `<:check:537885340304932875> **${responseMessage}**`) : null,
						color: 0x249e43,
						author: {
							name: client.user.username,
							iconURL: client.user.displayAvatarURL(),
						},
						...responseProps,
					},
				],
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
