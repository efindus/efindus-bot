const styles = {
	reset: [ 0, 0 ],
	bold: [ 1, 22 ],
};

const colors = {
	fg: {
		black: 30,
		red: 31,
		green: 32,
		yellow: 33,
		blue: 34,
		magenta: 35,
		cyan: 36,
		white: 37,

		blackBright: 90,
		redBright: 91,
		greenBright: 92,
		yellowBright: 93,
		blueBright: 94,
		magentaBright: 95,
		cyanBright: 96,
		whiteBright: 97,
	},
	bg: {
		bgBlack: 40,
		bgRed: 41,
		bgGreen: 42,
		bgYellow: 43,
		bgBlue: 44,
		bgMagenta: 45,
		bgCyan: 46,
		bgWhite: 47,

		bgBlackBright: 100,
		bgRedBright: 101,
		bgGreenBright: 102,
		bgYellowBright: 103,
		bgBlueBright: 104,
		bgMagentaBright: 105,
		bgCyanBright: 106,
		bgWhiteBright: 107,
	},
};

/**
 * @param {number} num
 * @returns {string}
 */
const createANSIEscape = (num) => {
	return `\x1b[${num}m`;
};

for (const [ styleName, style ] of Object.entries(styles)) {
	exports[styleName] = (string) => {
		return `${createANSIEscape(style[0])}${string}${createANSIEscape(style[1])}`;
	};
}

for (const [ typeName, type ] of Object.entries(colors)) {
	for (const [ colorName, color ] of Object.entries(type)) {
		exports[colorName] = (string) => {
			return `${createANSIEscape(color)}${string}${createANSIEscape(typeName === 'fg' ? 39 : 49)}`;
		};
	}
}
