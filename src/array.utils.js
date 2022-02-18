const { random } = require('./number.utils');

Array.prototype.shuffle = function() {
	for (let i = this.length - 1; i > 0; i--) {
		const j = random(0, i);
		[this[i], this[j]] = [this[j], this[i]];
	}

	return this;
};
