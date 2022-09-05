/**
 * @param {string} input - HH:MM:SS string to resolve to miliseconds
 * @returns {number} input resolved into miliseconds
 */
exports.getMS = (input) => {
	const parts = input.split(':');
	let result = 0, ratio = 1000;
	while (parts.length > 0 && ratio <= 1000 * 60 * 60) {
		result += (+parts.pop()) * ratio;
		ratio *= 60;
	}

	return result;
};

/**
 * @param {number} input - miliseconds to format into HH:MM:SS
 * @returns {string} input formatted into HH:MM:SS
 */
exports.formatMS = (input) => {
	if (!input) return '00:00';

	let result = '';
	input /= 1000, input = Math.round(input);
	const hours = Math.floor(input / 60 / 60);
	const minutes = `${Math.floor(input / 60 % 60)}`;
	const seconds = `${Math.floor(input % 60)}`;
	if (hours >= 1) result += `${`${hours}`.padStart(2, '0')}:`;
	result += `${minutes.padStart(2, '0')}:`;
	result += `${seconds.padStart(2, '0')}`;

	return result;
};

/**
 * Delay program execution by delay miliseconds
 * @param {number} delay - Number of miliseconds to delay execution for
 */
exports.wait = async (delay) => {
	await new Promise(res => setTimeout(res, delay));
};
