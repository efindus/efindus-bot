const { entersState, createAudioPlayer, createAudioResource, demuxProbe, NoSubscriberBehavior, VoiceConnectionStatus, VoiceConnectionDisconnectReason } = require('@discordjs/voice');
const youtubedl = require('youtube-dl-exec').exec;

const parse = require('../utils/parse');
const time = require('../utils/time');
const { UserError } = require('../utils/errors');

class Player {
	/**
	 * Currently played video
	 * @type {import('../index').QueueVideo}
	 */
	#nowPlaying = null;

	/**
	 * Queue of upcoming videos
	 * @type {import('../index').QueueVideo[]}
	 */
	#queue = [];

	/**
	 * 0 -> no loop; 1 -> single video loop; 2 -> queue loop
	 * @type {0 | 1 | 2}
	 */
	#loopType = 0;

	/**
	 * Current volume; 1 - 100%, .5 - 50%
	 * @type {number}
	 */
	#volume = 1;

	/**
	 * AudioPlayer instance for current server
	 * @type {import('@discordjs/voice').AudioPlayer}
	 */
	#player = null;

	/**
	 * AudioResource instance for currently played video
	 * @type {import('@discordjs/voice').AudioResource}
	 */
	#resource = null;

	/**
	 * Indicates whether leaving was intended by the bot
	 * @type {boolean}
	 */
	#isLeaving = false;

	/**
	 * Indicates that the bot currently is waiting for connection to enter ready state
	 * @type {boolean}
	 */
	#readyLock = false;

	/**
	 * Timeout object for autoleaving the VC
	 * @type {NodeJS.Timeout}
	 */
	#autoleaveTimeout = null;

	/**
	 * 0 - autoleave wasn't delayed; 1 - autoleave was delayed but bot didn't react yet; 2 - indicates that autoleave was delayed and that it got acknowledged
	 * @type {0 | 1 | 2}
	 */
	#delayedAutoleave = 0;

	/**
	 * VoiceConnection instance for current server
	 * @type {import('@discordjs/voice').VoiceConnection}
	 */
	#connection = null;

	/**
	 * ID of the VC the bot is connected to
	 * @type {import('discord.js').Snowflake}
	 */
	#channelId = '';

	/**
	 * Player creation timestamp
	 * @type {number}
	 */
	#creationTS = null;

	/**
	 * Function to be called when destroying the Player. Used by PlayerManager to remove the Player object from it's list
	 */
	#onDestroy = () => {
		// just initialize
	};

	get isLeaving() {
		return this.#isLeaving;
	}

	get channelId() {
		return this.#channelId;
	}

	set channelId(newChannelId) {
		this.#channelId = newChannelId;
	}

	get creationTS() {
		return this.#creationTS;
	}

	get nowPlaying() {
		return this.#nowPlaying;
	}

	get queue() {
		return this.#queue;
	}

	/**
	 * @param {import('@discordjs/voice').VoiceConnection} connection - VoiceConnection instance for this Player instance
	 * @param {import('discord.js').Snowflake} channelId - ID of the channel this Player instance is connected to
	 * @param {() => void} onDestroy - Function to be called when destroying the Player
	 */
	constructor(connection, channelId, onDestroy) {
		this.#player = createAudioPlayer({
			behaviors: {
				noSubscriber: NoSubscriberBehavior.Pause,
			},
		});

		this.#connection = connection;
		this.#channelId = channelId;
		this.#creationTS = Date.now();
		this.#onDestroy = onDestroy;

		// Stolen from https://github.com/discordjs/discord.js/blob/dfe449c253b617e8f92c720a2f71135aa1601a65/packages/voice/examples/music-bot/src/music/subscription.ts don't mind me
		this.#connection.on('stateChange', async (_, newState) => {
			if (newState.status === VoiceConnectionStatus.Disconnected) {
				if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
					/**
					 * If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
					 * but there is a chance the connection will recover itself if the reason of the disconnect was due to
					 * switching voice channels. This is also the same code for the bot being kicked from the voice channel,
					 * so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
					 * the voice connection.
					 */
					try {
						await entersState(this.#connection, VoiceConnectionStatus.Connecting, 5 * 1000);
						// Probably moved voice channel
					} catch {
						this.#connection.destroy();
						// Probably removed from voice channel
					}
				} else if (this.#connection.rejoinAttempts < 5) {
					/**
					 * The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
					 */
					await time.wait((this.#connection.rejoinAttempts + 1) * (5 * 1000));
					this.#connection.rejoin();
				} else {
					/**
					 * The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
					 */
					this.#connection.destroy();
				}
			} else if (newState.status === VoiceConnectionStatus.Destroyed) {
				/**
				 * The End.
				 */
				this.destroy();
			} else if (
				!this.#readyLock &&
				(newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
			) {
				/*
				 * In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
				 * before destroying the voice connection. This stops the voice connection permanently existing in one of these
				 * states.
				 */
				this.#readyLock = true;
				try {
					await entersState(this.#connection, VoiceConnectionStatus.Ready, 20 * 1000);
					this.#connection.subscribe(this.#player);
				} catch {
					if (this.#connection.state.status !== VoiceConnectionStatus.Destroyed)
						this.#connection.destroy();
				} finally {
					this.#readyLock = false;
				}
			}
		});
	}

	/**
	 * Start playing first entry in the queue if nothing is currently being played
	 */
	async play() {
		if (this.#nowPlaying || this.#queue.length === 0)
			return;

		this.#nowPlaying = this.#queue.shift();

		// FIXME: When video has multiple audio tracks it selects some non original one (for now that's only a problem when watching mrbeast's videos)
		const process = youtubedl(parse.getVideoURL(this.#nowPlaying.id), {
			o: '-',
			q: '',
			f: 'bestaudio[ext=webm+acodec=opus+asr=48000]/bestaudio',
			r: '100K',
		}, { stdio: [ 'ignore', 'pipe', 'ignore' ] });

		if (!process.stdout)
			throw new Error('No youtube-dl stdout!');
		const stream = process.stdout;

		const onError = (error) => {
			if (!process.killed)
				process.kill();

			stream.resume();
			throw error;
		};
		this.#resource = await new Promise((resolve) => {
			process.once('spawn', () => {
				demuxProbe(stream).then((probe) =>
					resolve(createAudioResource(probe.stream, { metadata: this, inputType: probe.type, inlineVolume: true })),
				).catch(onError);
			}).catch(onError);
		});

		this.#resource.playStream.on('end', () => {
			if (this.#loopType === 1) this.#queue.splice(0, 0, this.#nowPlaying);
			else if (this.#loopType === 2) this.#queue.push(this.#nowPlaying);

			this.#nowPlaying = null;
			this.#resource = null;
			this.play();
		});

		this.#resource.playStream.on('error', (err) => {
			console.log(err);
		});

		this.#resource.volume.setVolume(this.#volume);
		this.#player.play(this.#resource);
	}

	/**
	 * Skips a number of videos.
	 * @param {number} index - Position to start removing from
	 * @param {number} amount - Amount of videos to remove
	 * @returns {import('../index').QueueVideo[]} - Removed videos
	 */
	async skip(index, amount) {
		if ([ null, 0 ].includes(index)) {
			if (this.#queue.length === 0 && this.#nowPlaying === null) {
				throw new UserError('Nothing is currently playing!');
			} else {
				this.#player.stop();
				const removed = [ this.#nowPlaying ];
				this.#nowPlaying = null;

				if (amount > 0) removed.push(this.#queue.splice(0, amount - 1));
				await this.play();

				return removed;
			}
		} else {
			if (this.#queue.length === 0)
				throw new UserError('The queue is empty!');
			else if (index < 0 || this.#queue.length < index)
				throw new UserError('Invalid index!');
			else
				return this.#queue.splice(index - 1, amount);
		}
	}

	/**
	 * Pauses playback
	 * @returns {boolean} - True if succeeds, false otherwise
	 */
	pause() {
		return this.#player.pause();
	}

	/**
	 * Resumes playback
	 * @returns {boolean} - True if succeeds, false otherwise
	 */
	resume() {
		return this.#player.unpause();
	}

	/**
	 * Add a video to the queue.
	 * @param {import('./index').QueueVideo[]} videos - The video.
	 * @param {number} requestedPosition - Position to put new videos at.
	 */
	async addToQueue(videos, requestedPosition = null) {
		let queueIndex = this.#queue.length + 1;
		if (requestedPosition === null) {
			this.#queue.push(...videos);
		} else if (requestedPosition === 0) {
			this.player.stop();
			this.#nowPlaying = null;
			this.#queue.splice(0, 0, ...videos);
		} else {
			this.#queue.splice(requestedPosition - 1, 0, ...videos);
			queueIndex = requestedPosition;
		}

		if (!this.#nowPlaying) {
			await this.play();
			queueIndex = 0;
		}

		return queueIndex;
	}

	/**
	 * Shuffles the queue
	 */
	shuffleQueue() {
		this.#queue.shuffle();
	}

	/**
	 * Clears the queue
	 */
	clearQueue() {
		this.#queue = [];
	}

	/**
	 * Sets loop type
	 * @param {0 | 1 | 2} loopType - 0 -> no loop; 1 -> single video loop; 2 -> queue loop
	 */
	setLoopType(loopType) {
		this.#loopType = loopType;
	}

	/**
	 * Set playback volume
	 * @param {number} newVolume - New volume between 0 and 2
	 */
	setVolume(newVolume) {
		if (newVolume < 0 || newVolume > 2)
			throw new UserError('Invalid volume! Available range: 0-2');

		this.#volume = newVolume;
		if (this.#resource !== null)
			this.#resource.volume.setVolume(this.#volume);
	}

	/**
	 * Start autoleave
	 */
	startAutoleave() {
		if (this.#autoleaveTimeout !== null)
			this.resetAutoleave();

		const autoleave = async () => {
			if (this.#delayedAutoleave === 1) {
				this.#delayedAutoleave = 2;
				this.#autoleaveTimeout = setTimeout(autoleave, 5 * 60 * 1000);
			} else {
				this.destroy();
			}
		};
		this.#autoleaveTimeout = setTimeout(autoleave, 30 * 1000);
	}

	/**
	 * Increase the time it takes for the bot to autoleave
	 */
	delayAutoleave() {
		if (this.#autoleaveTimeout === null)
			throw new UserError('I\'m not currently autoleaving!');
		if (this.#delayedAutoleave !== 0)
			throw new UserError('Autoleave was already delayed!');
		this.#delayedAutoleave = 1;
	}

	/**
	 * Stop autoleave
	 */
	resetAutoleave() {
		this.#delayedAutoleave = 0;
		clearTimeout(this.#autoleaveTimeout);
		this.#autoleaveTimeout = null;
	}

	/**
	 * Destroy the player
	 */
	destroy() {
		this.#isLeaving = true;
		this.resetAutoleave();
		this.#player.stop();
		this.#connection.destroy();
		this.#onDestroy();
	}
}

module.exports = { Player };
