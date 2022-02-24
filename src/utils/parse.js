const URL = require('url');
const time = require('./time');

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
	return `[${queueVideo.title} [${progressMS ? `${time.formatMS(progressMS)}/` : ''}${time.formatMS(queueVideo.duration)}]](${this.getVideoURL(queueVideo.id)}) by **${queueVideo.author}**`;
};

/**
 * Turn a video object returned by any of the libraries into a standardized QueueVideo object
 * @param {import('ytsr').Video | import('ytpl').Item | import('youtube-sr').Video} rawVideo - Video object to standardize
 * @returns {import('../index').QueueVideo} Parsed video object
 */
exports.getQueueVideo = (rawVideo) => {
	return {
		id: rawVideo.id,
		title: rawVideo.title,
		author: rawVideo.channel?.name ?? rawVideo.author.name,
		duration: time.getMS(rawVideo.durationFormatted ?? rawVideo.duration),
	};
};

/**
 * Turn a playlist object into a simplified version with a list of QueueVideos
 * @param {import('ytpl').Result} rawPlaylist - Playlist object to standardize
 * @returns {import('../index').PlaylistResult} Parsed playlist object
 */
exports.getPlaylistResult = (rawPlaylist) => {
	return {
		id: rawPlaylist.id,
		title: rawPlaylist.title,
		author: rawPlaylist.author.name,
		thumbnailURL: rawPlaylist.bestThumbnail.url.split('?')[0],
		videos: rawPlaylist.items.map(item => this.getQueueVideo(item), this),
	};
};

/**
 * Get video ID from a URL
 * @param {string} url - URL to parse video ID from
 * @returns {string} Video ID
 */
exports.getVideoID = (url) => {
	const parsedUrl = URL.parse(url.trim(), true);
	return (parsedUrl.host === 'www.youtube.com' && parsedUrl.pathname === '/watch' ? parsedUrl.query['v'] : null) ?? (parsedUrl.host === 'youtu.be' ? parsedUrl.pathname.replace('/', '') : null);
};

/**
 * Get playlist ID from a URL
 * @param {string} url - URL to parse playlist ID from
 * @returns {string} Playlist ID
 */
exports.getPlaylistID = (url) => {
	const parsedUrl = URL.parse(url.trim(), true);
	return (parsedUrl.host === 'www.youtube.com' && parsedUrl.pathname === '/playlist' ? parsedUrl.query['list'] : null);
};

/**
 * Get URL of a video with given ID
 * @param {string} videoID - Video ID to make URL out of
 * @returns {string} URL to a video with given ID
 */
exports.getVideoURL = (videoID) => {
	return `https://www.youtube.com/watch?v=${videoID}`;
};

/**
 * Get URL of a playlist with given ID
 * @param {string} playlistID - Playlist ID to make URL out of
 * @returns {string} URL to a playlist with given ID
 */
exports.getPlaylistURL = (playlistID) => {
	return `https://www.youtube.com/playlist?list=${playlistID}`;
};

/**
 * Get thumbnail URL of a video with given ID
 * @param {string} videoID - Video ID to get thumbnail url of
 * @returns {string} Thubnail URL of a video with given ID
 */
exports.getVideoThubnailURL = (videoID) => {
	return `https://i.ytimg.com/vi/${videoID}/hq720.jpg`;
};
