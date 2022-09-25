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
