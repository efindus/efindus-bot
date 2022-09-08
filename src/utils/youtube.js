const ytsr = require('ytsr');
const ytpl = require('ytpl');
const youtubesr = require('youtube-sr').default;

const parse = require('./parse');
const { UserError } = require('./errors');

/**
 * Find videos.
 * @param {string} title - Video's title.
 * @param {number} limit - Number of videos to find.
 * @returns {Promise<import('../index').PlaylistResult | import('../index').QueueVideo | import('../index').QueueVideo[]>} Videos.
 */
exports.findVideos = async (query, limit) => {
	let url = query.trim(), playlist = false;

	const videoID = parse.getVideoID(url);
	if (videoID) {
		url = parse.getVideoURL(videoID);
	} else if (url.startsWith('https://www.youtube.com/')) {
		playlist = true;
	} else {
		url = (await ytsr.getFilters(url)).get('Type').get('Video').url;

		if (!url)
			throw new UserError('Video could not be found.');
	}

	if (playlist && limit === 1) {
		try {
			return parse.getPlaylistResult(await ytpl(url, { limit: 200 }));
		} catch (error) {
			throw new UserError('Unknown playlist!');
		}
	} else {
		if (limit !== 1 || url.startsWith('https://www.youtube.com/results')) {
			const results = await ytsr(url, { limit: limit });
			if (results.items.length === 0)
				throw new UserError('Video could not be found.');

			return limit === 1 ? parse.getQueueVideo(results.items[0]) : results.items.map(item => parse.getQueueVideo(item));
		} else {
			return parse.getQueueVideo(await youtubesr.getVideo(url));
		}
	}
};
