const ytsr = require('ytsr');
const ytpl = require('ytpl');
const youtubesr = require('youtube-sr').default;

const { UserError } = require('./errorHandler');
const { Video } = require('../structures/Video');
const { Playlist } = require('../structures/Playlist');

/**
 * Find videos.
 * @template {number} T
 * @param {string} query - Query (url or title).
 * @param {T} limit - Number of videos to find.
 * @returns {Promise<T extends 1 ? Playlist | Video : Video[]>} Videos.
 */
exports.findVideos = async (query, limit) => {
	let url = query.trim();

	const videoID = Video.getID(url), playlistID = Playlist.getID(url);
	if (limit === 1) {
		if (videoID) {
			const video = await youtubesr.getVideo(Video.getURL(videoID));
			if (video)
				return Video.fromRaw(video);
			else
				throw new UserError('Video could not be found.');
		} else if (playlistID) {
			try {
				return Playlist.fromRaw(await ytpl(Playlist.getURL(playlistID), { limit: 200 }));
			} catch (error) {
				throw new UserError('Unknown playlist!');
			}
		}
	}

	url = (await ytsr.getFilters(url)).get('Type').get('Video').url;
	if (!url)
		throw new UserError('Video could not be found.');

	const results = await ytsr(url, { limit });
	if (results.items.length === 0)
		throw new UserError('Video could not be found.');

	return limit === 1 ? Video.fromRaw(results.items[0]) : results.items.map(item => Video.fromRaw(item));
};
