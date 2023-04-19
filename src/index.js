require('dotenv').config();
const { existsSync } = require('fs');

require('./utils/array');
require('./utils/errorHandler');
const { Bot } = require('./bot');
const config = existsSync('./config.js') ? require('../config') : require('../config.example');

/*
 * ROADMAP:
 * finish rewrite (implement Queue, remove models.js)
 * show duration when queuing a playlist (and maybe time to play), add total queue duration in /queue
 * implement /seek (to power filters and sponsorblock)
 * add /djcontrols command which would allow to control playback using buttons and selection menus (pause, resume, loop control etc)
 * add /dev command (for now just /dev eval and /dev help), responses should be ephemeral and the command should only have one argument (a string) as it will be visible to everyone due to the way slash commands work
 * add sponsorblock support
 * add filters (from here: https://github.com/Androz2091/discord-player/blob/master/packages/discord-player/src/utils/AudioFilters.ts)
 * more dev commands and random utility ones like poll, rng etc.
 * soundcloud support
 *
 * reference: https://github.com/discordjs/discord.js/tree/72577c4bfd02524a27afb6ff4aebba9301a690d3/packages/voice/examples/music-bot
 */

new Bot({
	botToken: process.env.TOKEN,
	mongoConnectionString: process.env.DB_CONNECTION_STRING,
	config: config,
});
