require('dotenv').config();
require('./array.utils');
const { Client } = require('discord.js');
const { entersState, joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, VoiceConnectionStatus } = require('@discordjs/voice');
const search = require('ytsr');
const download = require('youtube-dl-exec').exec;

// https://github.com/discordjs/voice/tree/main/examples/music-bot/src/music

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
			description: 'Loop the video.',
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
		},
	]);

	console.log(`\x1b[37m\x1b[42mREADY\x1b[0m ${client.user.tag} is ready!`);
});

const players = {};

/**
 * Connect to a voice channel.
 * @param {import("discord.js").Interaction} interaction - User's interaction.
 */

const connectToChannel = async (interaction) => {
	if(!interaction.member.voice.channel) {
		// Problem Exists Between Keyboard And Chair
		throw new Error('PEBKAC:You\'re not connected to any voice channel on this server.');
	}

	if(!interaction.guild.me.voice.channel) {
		const connection = await joinVoiceChannel({
			channelId: interaction.member.voice.channelId,
			guildId: interaction.guildId,
			adapterCreator: interaction.guild.voiceAdapterCreator,
		});

		if(players[interaction.guild.id]) {
			return;
		}

		players[interaction.guild.id] = {
			nowPlaying: null,
			queue: [],
			paused: false,
			looped: false,
			player: createAudioPlayer({
				behaviors: {
					noSubscriber: NoSubscriberBehavior.Pause,
				},
			}),
		};

		/* players[interaction.guild.id].player.on("error", (err) =>
		{
			console.log(err);
		}) */

		try {
			await entersState(connection, VoiceConnectionStatus.Ready, 20000);
			connection.subscribe(players[interaction.guild.id].player);
		} catch {
			throw new Error('Failed to join the voice channel within 20 seconds. Please try again later.');
		}
	} else if(interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
		throw new Error(`PEBKAC:You're not connected to <#${interaction.guild.me.voice.channelId}>`);
	}
};

/**
 * Check if user is connected to the channel.
 * @param {import("discord.js").Interaction} interaction - User's interaction.
 */

const checkConnection = (interaction) => {
	if(!interaction.guild.me.voice.channel) {
		throw new Error('PEBKAC:I\'m not connected to any voice channel on this server.');
	}

	if(interaction.member.voice.channelId !== interaction.guild.me.voice.channelId) {
		throw new Error(`PEBKAC:You're not connected to <#${interaction.guild.me.voice.channelId}>`);
	}
};

/**
 * Add a video to the queue.
 * @param {import("ytsr").Item} video - The video.
 * @param {string} guildId - Guild's id.
 */

const addToQueue = async (video, guildId) => {
	players[guildId].queue.push({
		url: video.url,
		title: video.title,
		author: video.author.name,
		duration: video.duration,
		resource: null,
	});

	if(!players[guildId].nowPlaying) {
		await play(guildId);
		return 0;
	}

	return players[guildId].queue.length;
};

/**
 * Find videos.
 * @param {string} title - Video's title.
 * @param {number} limit - Number of videos to find.
 * @returns {import("ytsr").Item[]} Videos.
 */

const findVideos = async (title, limit) => {
	const url = (await search.getFilters(title)).get('Type').get('Video').url;

	if(!url) {
		throw new Error('PEBKAC:Video could not be found.');
	}

	const results = await search(url, { limit: limit });

	if(results.items.length === 0) {
		throw new Error('PEBKAC:Video could not be found.');
	}

	return results.items;
};

const play = async (guildId) => {
	if(players[guildId].nowPlaying || players[guildId].queue.length === 0) {
		return;
	}

	players[guildId].nowPlaying = players[guildId].queue.shift();

	const stream = download(players[guildId].nowPlaying.url, {
		o: '-',
		q: '',
		f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
		r: '100K',
	}, { stdio: ['ignore', 'pipe', 'ignore'] });

	const resource = createAudioResource(stream.stdout);

	resource.playStream.on('end', () => {
		players[guildId].nowPlaying = null;
		play(guildId);
	});

	resource.playStream.on('error', (err) => {
		console.log(err);
	});

	players[guildId].resource = resource;
	players[guildId].player.play(resource);
};

client.on('interactionCreate', async (interaction) => {
	if(!interaction.guild) {
		return;
	}

	try {
		await interaction.deferReply();

		if(interaction.isCommand()) {
			switch(interaction.commandName) {
				case 'play': {
					await connectToChannel(interaction);

					const results = await findVideos(interaction.options.getString('query'), 1);
					const position = await addToQueue(results[0], interaction.guild.id);

					interaction.editReply({
						embeds: [
							{
								title: '<:check:537885340304932875> ' + (position === 0 ? 'Now playing!' : `Video has been added to the queue! (#${position})`),
								description: `[${results[0].title} [${results[0].duration}]](${results[0].url}) by **${results[0].author.name}**`,
								thumbnail: {
									url: results[0].bestThumbnail.url,
								},
								color: 0x249e43,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
							},
						],
					});

					break;
				}

				case 'search': {
					await connectToChannel(interaction);

					const results = await findVideos(interaction.options.getString('query'), 10);

					const videos = [];

					results.forEach((video) => {
						videos.push({
							label: video.title,
							description: video.author.name,
							value: video.url,
						});
					});

					interaction.editReply({
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
					});

					break;
				}

				case 'skip': {
					checkConnection(interaction);

					let index = -1;

					try {
						index = interaction.options.getInteger('position');
					} catch(error) {
						throw new Error('PEBKAC:Invalid index value!');
					}

					if (index === null || index === 0) {
						if (players[interaction.guild.id].queue.length === 0 && players[interaction.guild.id].nowPlaying === null) {
							throw new Error('PEBKAC:Nothing is currently playing!');
						} else {
							players[interaction.guild.id].resource.playStream.destroy();
							players[interaction.guild.id].nowPlaying = null;

							await play(interaction.guild.id);

							interaction.editReply({
								embeds: [
									{
										description: '<:check:537885340304932875> **Video has been skipped!**',
										color: 0x249e43,
										author: {
											name: client.user.username,
											iconURL: client.user.displayAvatarURL(),
										},
									},
								],
							});
						}
					} else {
						const queue = players[interaction.guild.id].queue;
						if (queue.length === 0) {
							throw new Error('PEBKAC:The queue is empty!');
						} else if (queue.length < index || index < 0) {
							throw new Error('PEBKAC:Invalid index!');
						} else {
							const removed = queue.splice(index - 1, 1)[0];
							interaction.editReply({
								embeds: [
									{
										description: `<:check:537885340304932875> [${removed.title.slice(0, 75)} [${removed.duration}]](${removed.url}) by **${removed.author.slice(0, 45)}** has been skipped!`,
										color: 0x249e43,
										author: {
											name: client.user.username,
											iconURL: client.user.displayAvatarURL(),
										},
									},
								],
							});
						}
					}

					break;
				}

				case 'queue': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					let formattedQueue = '';

					if (player.nowPlaying !== null) {
						formattedQueue += `:play_pause: **Currently playing:**\n**[0]** [${player.nowPlaying.title.slice(0, 75)} [${player.nowPlaying.duration}]](${player.nowPlaying.url}) by **${player.nowPlaying.author.slice(0, 45)}**\n\n`;
					}

					if (player.queue.length !== 0) {
						formattedQueue += `:notepad_spiral: **Current queue [${player.queue.length}]:**\n`;
						for(let i = 0; i < player.queue.length; i++) {
							formattedQueue += `**[${i + 1}]** [${player.queue[i].title.slice(0, 75)} [${player.queue[i].duration}]](${player.queue[i].url}) by **${player.queue[i].author.slice(0, 45)}**\n`;
						}
					}

					if (formattedQueue.length > 2000) {
						formattedQueue = formattedQueue.slice(0, 1997);
						formattedQueue += '...';
					} else if (formattedQueue.length === 0) {
						formattedQueue = '<:cross:537885611865145367> **Nothing is currently playing!**';
					}

					interaction.editReply({
						embeds: [
							{
								description: formattedQueue,
								color: 0x249e43,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
							},
						],
					});

					break;
				}

				case 'clear': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) {
						throw new Error('PEBKAC:The queue is empty!');
					} else {
						player.queue = [];

						interaction.editReply({
							embeds: [
								{
									description: '<:check:537885340304932875> **Cleared the queue!**',
									color: 0x249e43,
									author: {
										name: client.user.username,
										iconURL: client.user.displayAvatarURL(),
									},
								},
							],
						});
					}
					break;
				}

				case 'shuffle': {
					checkConnection(interaction);
					const player = players[interaction.guild.id];

					if (player.queue.length === 0) {
						throw new Error('PEBKAC:The queue is empty!');
					} else {
						player.queue.shuffle();

						interaction.editReply({
							embeds: [
								{
									description: '<:check:537885340304932875> **Shuffled the queue!**',
									color: 0x249e43,
									author: {
										name: client.user.username,
										iconURL: client.user.displayAvatarURL(),
									},
								},
							],
						});
					}
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
		} else if(interaction.isSelectMenu()) {
			switch(interaction.customId) {
				case 'search': {
					await connectToChannel(interaction);

					const results = await findVideos(interaction.values[0]);
					const position = await addToQueue(results[0], interaction.guild.id);

					interaction.editReply({
						embeds: [
							{
								title: '<:check:537885340304932875> ' + (position === 0 ? 'Now playing!' : `Video has been added to the queue! (#${position})`),
								description: `[${results[0].title} [${results[0].duration}]](${results[0].url}) by **${results[0].author.name}**`,
								thumbnail: {
									url: results[0].bestThumbnail.url,
								},
								color: 0x249e43,
								author: {
									name: client.user.username,
									iconURL: client.user.displayAvatarURL(),
								},
							},
						],
					});

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
	} catch(error) {
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

process.on('uncaughtException', error => {
	console.log(error);
});

process.on('unhandledRejection', error => {
	console.log(error);
});

client.login(process.env.TOKEN);
