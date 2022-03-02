const time = require('./time');
const parse = require('./parse');

/**
 * Generate text with video name, author and duration hyperlinked to YouTube
 * @param {import('../index').QueueVideo} queueVideo - Video to represent
 * @returns {string} Formatted text
 */
exports.formatVideo = (queueVideo) => {
	return this.formatVideoWithProgress(queueVideo, null);
};

/**
 * Generate text with video name, author, duration and progress hyperlinked to YouTube
 * @param {import('../index').QueueVideo} queueVideo - Video to represent
 * @param {number | null} progressMS - Current playback position in MS
 * @returns {string} Formatted text
 */
exports.formatVideoWithProgress = (queueVideo, progressMS) => {
	return `[${queueVideo.title} [${progressMS ? `${time.formatMS(progressMS)}/` : ''}${time.formatMS(queueVideo.duration)}]](${parse.getVideoURL(queueVideo.id)}) by **${queueVideo.author}**`;
};

/**
 * Format queue data of a player into embed-ready format
 * @param {import('../index').PlayerObject} player - Player instance to get queue data from
 * @param {number} pageIndex - Index of queue page to generate. If such page index doesn't exist it will be capped to the closest index, and it will be returned
 * @returns Formatted queue and the actual pageIndex
 */
exports.formatQueue = (player, pageIndex) => {
	if (pageIndex < 0) pageIndex = 0;
	let formattedQueue = '';

	if (player.nowPlaying !== null) formattedQueue += `:play_pause: **Currently playing${player.loopType === 0 ? '' : ` [loop: ${player.loopType === 1 ? 'video' : 'queue'}]`}:**\n**[0]** ${this.formatVideoWithProgress(player.nowPlaying, player.player.state.playbackDuration)}\n\n`;

	if (player.queue.length < pageIndex * 10) pageIndex = Math.floor(player.queue.length / 10);
	if (player.queue.length !== 0) {
		formattedQueue += `:notepad_spiral: **Current queue [${player.queue.length}]:**\n`;
		for (let i = pageIndex * 10; i < Math.min(player.queue.length, (pageIndex + 1) * 10); i++) {
			formattedQueue += `**[${i + 1}]** ${this.formatVideo(player.queue[i])}\n`;
		}
	}

	return {
		formattedQueue,
		pageIndex,
	};
};
