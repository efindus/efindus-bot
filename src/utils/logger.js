const { bgBlue, bgGreen, bgYellowBright, bgRedBright, whiteBright, black, green } = require('./colors');

class Logger {
	/**
	 * @param {'info' | 'warn' | 'error' | 'debug' | 'ready'} logLevel
	 * @param {string} message
	 */
	log(logLevel, message) {
		let logPrefix = `[${new Date().toLocaleString('pl').replace(',', '')}] `;
		switch (logLevel) {
			case 'error':
				logPrefix += `${bgRedBright(whiteBright(logLevel.toUpperCase()))}`;
				break;
			case 'warn':
				logPrefix += ` ${bgYellowBright(black(logLevel.toUpperCase()))}`;
				break;
			case 'ready':
				logPrefix += `${bgGreen(black(logLevel.toUpperCase()))}`;
				break;
			case 'debug':
				if (process.env['NODE_ENV'] !== 'development') return;
				logPrefix += `${green(logLevel.toUpperCase())}`;
				break;
			case 'info':
				logPrefix += ` ${bgBlue(whiteBright(logLevel.toUpperCase()))}`;
				break;
			default:
				throw new Error('Log level must be one of the following: info, warn, error, debug, ready');
		}

		console.log(`${logPrefix} ${message.replace(/\n/g, `\n${logPrefix} `)}`);
	}

	info(message) {
		this.log('info', message);
	}

	error(message) {
		this.log('error', message);
	}

	warn(message) {
		this.log('warn', message);
	}

	debug(message) {
		this.log('debug', message);
	}

	ready(message) {
		this.log('ready', message);
	}
}

const logger = new Logger();

module.exports = { logger };
