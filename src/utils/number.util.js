const { randomBytes } = require('crypto');

exports.random = (min, max) => {
	return min + Math.floor(randomBytes(4).readUInt32LE() / 0xffffffff * (max - min + 1));
};
