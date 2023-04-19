const ytsr = require('ytsr');
const ytpl = require('ytpl');
const youtubesr = require('youtube-sr').default;

const { Video } = require('../structures/Video');
const { Playlist } = require('../structures/Playlist');
const { ResponseError } = require('../structures/Command');

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
			if (video) {
				if (video.live || video.duration === 0)
					throw new ResponseError('Invalid video type.');

				return Video.fromRaw(video);
			} else {
				throw new ResponseError('Video could not be found.');
			}
		} else if (playlistID) {
			try {
				return Playlist.fromRaw(await ytpl(Playlist.getURL(playlistID), { limit: 200 }));
			} catch (error) {
				throw new ResponseError('Unknown playlist!');
			}
		}
	}

	url = (await ytsr.getFilters(url)).get('Type').get('Video').url;
	if (!url)
		throw new ResponseError('Video could not be found.');

	const results = await ytsr(url, { limit: 2 * limit });
	if (results.items.length === 0)
		throw new ResponseError('Video could not be found.');

	if (limit === 1) {
		if (results.items[0].isLive || results.items[0].isUpcoming)
			throw new ResponseError('Invalid video type.');

		return Video.fromRaw(results.items[0]);
	} else {
		const result = results.items.filter(v => !(v.isLive || v.isUpcoming || v.type !== 'video')).map(item => Video.fromRaw(item)).slice(0, limit);
		if (result.length === 0)
			throw new ResponseError('Video could not be found.');

		return result;
	}
};
