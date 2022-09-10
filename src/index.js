require('dotenv').config();

require('./utils/array');
const { Bot } = require('./bot');
const { logger } = require('./utils/logger');

/*
 * ROADMAP:
 * show duration in more places (and make queue total duration)
 * think about making a /djcontrols command which would allow to perform various actions using buttons and selection menus (pause, resume, loop control etc)
 * start utilizing the footer (like in the old play), after this rename old newFindusBot repo into NeverFindusBoT and switch to using that as a remote
 * implement seek (mainly as a functionality to power filters)
 * add /dev command (for now just /dev eval and /dev help), responses should be ephemeral and the command should only have one argument (a string) as it will be visible to everyone due to the way slash commands work
 * add filters (from here: https://github.com/Androz2091/discord-player/blob/master/src/utils/AudioFilters.ts)
 * aim for version 4.1.0 here
 * more dev commands and random utility ones like poll, rng etc.
 * 4.2.0 here
 * soundcloud support
 * 4.3.0 here
 * (reminder for the future) bump version
 * https://github.com/discordjs/discord.js/blob/main/packages/voice/examples/music-bot/src/music
 */

new Bot({
	botToken: process.env.TOKEN,
});

process.on('uncaughtException', error => {
	logger.error(error.stack ?? error.message);
});

process.on('unhandledRejection', error => {
	logger.error(error.stack ?? error.message);
});
