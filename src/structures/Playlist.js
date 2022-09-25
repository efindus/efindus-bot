const { Video } = require('./Video');

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
	 * @param {object} data
	 * @param {string} data.id
	 * @param {string} data.title
	 * @param {string} data.author
	 * @param {number} data.duration
	 * @param {string} data.thumbnailURL
	 * @param {Video[]} data.videos
	 */
	constructor(data) {
		this.#id = data.id;
		this.#title = data.title;
		this.#author = data.author;
		this.#duration = data.duration;
		this.#thumbnailURL = data.thumbnailURL;
		this.#videos = data.videos;
	}
}

module.exports = { Playlist };
