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
 * @param {import('../modules/player').Player} player - Player instance to get queue data from
 * @param {number} pageIndex - Index of queue page to generate. If such page index doesn't exist it will be capped to the closest index, and it will be returned
 * @returns Formatted queue and the actual pageIndex
 */
exports.formatQueue = (player, pageIndex) => {
	let formattedQueue = '';
	if (pageIndex < 0)
		pageIndex = 0;

	if (player.nowPlaying !== null)
		formattedQueue += `:play_pause: **Currently playing${player.loopType === 0 ? '' : ` [loop: ${player.loopType === 1 ? 'video' : 'queue'}]`}:**\n**[0]** ${this.formatVideoWithProgress(player.nowPlaying, player.playtimeDuration)}\n\n`;

	if (player.queueLength <= pageIndex * 10)
		pageIndex = player.lastQueuePage;

	if (player.queueLength !== 0) {
		formattedQueue += `:notepad_spiral: **Current queue [${player.queueLength}]:**\n`;
		for (let i = pageIndex * 10; i < Math.min(player.queueLength, (pageIndex + 1) * 10); i++)
			formattedQueue += `**[${i + 1}]** ${this.formatVideo(player.queue[i])}\n`;
	}

	return {
		formattedQueue: formattedQueue.length > 0 ? formattedQueue : '**Nothing is currently playing!**',
		pageIndex: formattedQueue.length > 0 ? pageIndex : -1,
		color: formattedQueue.length > 0 ? 'green' : 'red',
	};
};
