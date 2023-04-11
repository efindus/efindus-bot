const URL = require('url');

const time = require('../utils/time');

const videoIDRegex = /^[a-zA-Z0-9-_]{11}$/;
class Video {
	#id;
	#title;
	#author;
	#duration;

	/**
	 * ID of the video
	 */
	get id() {
		return this.#id;
	}

	/**
	 * Title of the video
	 */
	get title() {
		return this.#title;
	}

	/**
	 * Name of the channel that uploaded the video
	 */
	get author() {
		return this.#author;
	}

	/**
	 * Duration of the video in miliseconds
	 */
	get duration() {
		return this.#duration;
	}

	get url() {
		return Video.getURL(this.#id);
	}

	get thumbnailURL() {
		return Video.getThumbnailURL(this.#id);
	}

	/**
	 * Get video ID from a URL
	 * @param {string} url - URL to parse video ID from
	 * @returns {string} Video ID
	 */
	static getID(url) {
		const parsedUrl = URL.parse(url.trim(), true);

		let videoID = null;
		if (parsedUrl.host === 'youtu.be')
			videoID = parsedUrl.pathname.replace('/', '');
		else if (parsedUrl.host && parsedUrl.host.endsWith('youtube.com') && parsedUrl.pathname === '/watch')
			videoID = parsedUrl.query['v'];

		if (typeof videoID === 'string' && videoID.match(videoIDRegex))
			return videoID;
		else
			return null;
	}

	/**
	 * Get URL of a video with given ID
	 * @param {string} videoID - Video ID to make URL out of
	 * @returns {string} URL to a video with given ID
	 */
	static getURL(videoID) {
		return `https://www.youtube.com/watch?v=${videoID}`;
	}

	/**
	 * Get thumbnail URL of a video with given ID
	 * @param {string} videoID - Video ID to get thumbnail url of
	 * @returns {string} Thubnail URL of a video with given ID
	 */
	static getThumbnailURL(videoID) {
		return `https://i3.ytimg.com/vi/${videoID}/maxresdefault.jpg`;
	}

	/**
	 * Turn a video object returned by any of the libraries into the internal Video class
	 * @param {import('ytsr').Video | import('ytpl').Item | import('youtube-sr').Video} rawVideo - Video object to convert
	 */
	static fromRaw(rawVideo) {
		return new Video({
			id: rawVideo.id,
			title: rawVideo.title,
			author: rawVideo.channel?.name ?? rawVideo.author.name,
			duration: time.getMS(rawVideo.durationFormatted ?? rawVideo.duration),
		});
	}

	/**
	 * @param {object} data
	 * @param {string} data.id
	 * @param {string} data.title
	 * @param {string} data.author
	 * @param {number} data.duration
	 */
	constructor(data) {
		this.#id = data.id;
		this.#title = data.title;
		this.#author = data.author;
		this.#duration = data.duration;
	}
}

module.exports = { Video };
