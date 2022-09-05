const { joinVoiceChannel } = require('@discordjs/voice');

const { UserError } = require('../utils/errors');
const { Player } = require('./player');

class PlayerManager {
	/**
	 * @type {Record<string, Player>}
	 */
	#players = {};

	/**
	 * @param {import('discord.js').Client} client - Discord.JS client instance
	 */
	constructor(client) {
		client.on('voiceStateUpdate', async (oldState, newState) => {
			const player = this.#players[oldState.guild.id];
			if (!player)
				return;

			if (oldState.id === client.user.id) {
				if (newState.channelId) {
					player.channelId = newState.channelId;
				} else {
					if (!player.isLeaving)
						player.destroy();

					return;
				}
			}

			if ([ oldState.channelId, newState.channelId ].includes(player.channelId)) {
				if ((await client.channels.fetch(player.channelId)).members.size === 1)
					player.startAutoleave();
				else if (player.autoleaveTimeout !== null)
					player.resetAutoleave();
			}
		});
	}

	/**
	 * Creates a new player and connects it to the channel the user is connected to
	 * @param {import('discord.js').GuildMember} user
	 * @returns {Player}
	 */
	async connect(user) {
		if (!user.voice.channel)
			throw new UserError('You\'re not connected to any voice channel on this server.');

		if (!user.voice.channel.joinable)
			throw new UserError('I don\'t have sufficient permissions to join this voice channel!');

		if (!user.guild.me.voice.channel || !this.#players[user.guild.id]) {
			const connection = await joinVoiceChannel({
				channelId: user.voice.channelId,
				guildId: user.guildId,
				adapterCreator: user.guild.voiceAdapterCreator,
			});

			if (this.#players[user.guild.id])
				return this.#players[user.guild.id];

			this.#players[user.guild.id] = new Player(connection, user.voice.channelId, () => {
				delete this.#players[user.guild.id];
			});

			return this.#players[user.guild.id];
		} else if (user.voice.channelId !== user.guild.me.voice.channelId) {
			throw new UserError(`You're not connected to <#${user.guild.me.voice.channelId}>`);
		}
	}

	getPlayer(guildId) {
		return this.#players[guildId];
	}

	leave(guildId) {
		this.#players[guildId].destroy();
	}
}

module.exports = { PlayerManager };
