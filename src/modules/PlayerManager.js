const { joinVoiceChannel } = require('@discordjs/voice');

const { Player } = require('../structures/Player');
const { ResponseError } = require('../structures/Command');

class PlayerManager {
	/**
	 * @type {Record<string, Player>}
	 */
	#players = {};

	/**
	 * @param {import('../bot').Bot} bot - Bot instance
	 */
	constructor(bot) {
		bot.client.on('voiceStateUpdate', async (oldState, newState) => {
			const player = this.#players[oldState.guild.id];
			if (!player)
				return;

			if (oldState.id === bot.client.user.id) {
				if (newState.channelId) {
					player.channelId = newState.channelId;
				} else {
					if (!player.isLeaving)
						player.destroy();

					return;
				}
			}

			if ([ oldState.channelId, newState.channelId ].includes(player.channelId)) {
				if ((await bot.client.channels.fetch(player.channelId)).members.size === 1)
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
		if (this.#players[user.guild.id])
			return this.#players[user.guild.id];

		if (!user.voice.channel)
			throw new ResponseError('You\'re not connected to any voice channel on this server.');

		if (!user.voice.channel.joinable)
			throw new ResponseError('I don\'t have sufficient permissions to join this voice channel!');

		if (!user.guild.members.me.voice.channel || !this.#players[user.guild.id]) {
			const connection = await joinVoiceChannel({
				channelId: user.voice.channelId,
				guildId: user.guild.id,
				adapterCreator: user.guild.voiceAdapterCreator,
			});

			if (!this.#players[user.guild.id]) {
				await new Promise((resolve) => {
					this.#players[user.guild.id] = new Player(connection, user.voice.channelId, () => {
						resolve();
					}, () => {
						delete this.#players[user.guild.id];
					});
				});
			}

			return this.#players[user.guild.id];
		} else if (user.voice.channelId !== user.guild.members.me.voice.channelId) {
			throw new ResponseError(`You're not connected to <#${user.guild.members.me.voice.channelId}>`);
		}
	}

	getPlayer(guildId) {
		return this.#players[guildId] ?? null;
	}

	leave(guildId) {
		this.#players[guildId].destroy();
	}
}

module.exports = { PlayerManager };
