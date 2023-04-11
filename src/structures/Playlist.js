const URL = require('url');

const { Video } = require('./Video');

const playlistIDRegex = /(PL|FL|UU|LL|RD|OL)[a-zA-Z0-9-_]{16,41}/;
class Playlist {
	#id;
	#title;
	#author;
	#duration;
	#thumbnailURL;
	#videos;

	/**
	 * ID of the playlist
	 */
	get id() {
		return this.#id;
	}

	/**
	 * Title of the playlist
	 */
	get title() {
		return this.#title;
	}

	/**
	 * Name of the channel that created the playlist
	 */
	get author() {
		return this.#author;
	}

	/**
	 * Duration of the playlist in miliseconds
	 */
	get duration() {
		return this.#duration;
	}

	get url() {
		return Playlist.getURL(this.#id);
	}

	/**
	 * URL for the thumbnail of the playlist
	 */
	get thumbnailURL() {
		return this.#thumbnailURL;
	}

	/**
	 * List of videos in the playlist
	 */
	get videos() {
		return this.#videos;
	}

	/**
	 * Get playlist ID from a URL
	 * @param {string} url - URL to parse playlist ID from
	 * @returns {string} Playlist ID
	 */
	static getID(url) {
		const parsedUrl = URL.parse(url.trim(), true);

		const playlistID = (parsedUrl.host && parsedUrl.host.endsWith('youtube.com') && parsedUrl.pathname === '/playlist' ? parsedUrl.query['list'] : '');
		if (playlistID.match(playlistIDRegex))
			return playlistID;
		else
			return null;
	}

	/**
	 * Get URL of a playlist with given ID
	 * @param {string} playlistID - Playlist ID to make URL out of
	 * @returns {string} URL to a playlist with given ID
	 */
	static getURL(playlistID) {
		return `https://www.youtube.com/playlist?list=${playlistID}`;
	}

	/**
	 * Turn a playlist object returned by ytpl into the internal Playlist class
	 * @param {import('ytpl').Result} rawPlaylist - Playlist object to convert
	 */
	static fromRaw(rawPlaylist) {
		return new Playlist({
			id: rawPlaylist.id,
			title: rawPlaylist.title,
			author: rawPlaylist.author.name,
			thumbnailURL: rawPlaylist.bestThumbnail.url.split('?')[0],
			videos: rawPlaylist.items.map(item => Video.fromRaw(item)),
		});
	}

	/**
	 * @param {object} data
	 * @param {string} data.id
	 * @param {string} data.title
	 * @param {string} data.author
	 * @param {string} data.thumbnailURL
	 * @param {Video[]} data.videos
	 */
	constructor(data) {
		this.#id = data.id;
		this.#title = data.title;
		this.#author = data.author;
		this.#thumbnailURL = data.thumbnailURL;
		this.#videos = data.videos;

		this.#duration = 0;
		this.#videos.forEach(video => this.#duration += video.duration, this);
	}
}

module.exports = { Playlist };
