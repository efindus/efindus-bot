/**
 * @typedef VoiceRequirements
 * 0 - none;
 * 1 - guarantees that the bot is connected to a VC;
 * 2 - additionally guarantees that the member running the command is connected to the same VC as the bot;
 * @type {0 | 1 | 2}
 */

/**
 * @typedef InteractionTypes
 * @type {Record<'command' | 'button' | 'stringSelectMenu', { enabled: boolean, ephemeral?: boolean, deferReply?: boolean, voiceRequirements?: VoiceRequirements }>}
 */

class Response {
	title;
	message;
	components;
	customFormatting;
	customProperties;
	customEmbedProperties;

	/**
	 * @param {object} data
	 * @param {string?} data.title
	 * @param {string?} data.message
	 * @param {boolean?} data.customFormatting
	 * @param {import('discord.js').APIActionRowComponent<import('discord.js').APIMessageActionRowComponent>[]?} data.components
	 * @param {import('discord.js').APIEmbed?} data.customEmbedProperties
	 * @param {(import('discord.js').InteractionReplyOptions | import('discord.js').MessagePayload)?} data.customProperties - If provided will replace all other properties
	 */
	constructor(data) {
		this.title = data.title ?? '';
		this.message = data.message ?? '';
		this.customFormatting = data.customFormatting ?? false;
		this.components = data.components;
		this.customProperties = data.customProperties;
		this.customEmbedProperties = data.customEmbedProperties ?? {};
	}
}

class Command {
	#name;
	#description;
	#ephemeral;
	#deferReply;
	#editsMessage;
	#availableInDMs;
	#voiceRequirements;
	#interactionTypes;
	#options;
	#run;

	/**
	 * Should the response be private
	 */
	get ephemeral() {
		return this.#ephemeral;
	}

	/**
	 * Should the reply be deffered (gives more time for the reply)
	 */
	get deferReply() {
		return this.#deferReply;
	}

	/**
	 * Defines whether the command will edit the message or reply to the message
	 */
	get editsMessage() {
		return this.#editsMessage;
	}

	/**
	 * Should the command be available in DMs
	 */
	get availableInDMs() {
		return this.#availableInDMs;
	}

	/**
	 * 0 - none;
	 * 1 - guarantees that the bot is connected to a VC;
	 * 2 - additionally guarantees that the member running the command is connected to the same VC as the bot;
	 * @type {VoiceRequirements}
	 */
	get voiceRequirements() {
		return this.#voiceRequirements;
	}

	/**
	 * Types of interactions forwarded to the command, if ephemeral or deferReply fields are present they will overwrite the main ones
	 * @type {InteractionTypes}
	 */
	get interactionTypes() {
		return this.#interactionTypes;
	}

	get run() {
		return this.#run;
	}

	get commandObject() {
		return {
			name: this.#name,
			description: this.#description,
			dmPermission: this.#availableInDMs,
			options: this.#options,
		};
	}

	/**
	 * Create a new command
	 * @param {object} data
	 * @param {string} data.name
	 * @param {string} data.description
	 * @param {boolean?} data.ephemeral
	 * @param {boolean?} data.deferReply
	 * @param {boolean?} data.editsMessage
	 * @param {boolean?} data.availableInDMs
	 * @param {VoiceRequirements?} data.voiceRequirements
	 * @param {InteractionTypes?} data.interactionTypes
	 * @param {import('discord.js').ApplicationCommandOptionData[]?} data.options
	 * @param {(data: { bot: import('../bot').Bot, interaction: import('discord.js').Interaction, player: import('./Player').Player, interactionType: 'command' | 'button' | 'stringSelectMenu' }) => Promise<Response>} data.run
	 */
	constructor(data) {
		this.#name = data.name;
		this.#description = data.description;
		this.#ephemeral = data.ephemeral ?? false;
		this.#deferReply = data.deferReply ?? false;
		this.#editsMessage = data.editsMessage ?? false;
		this.#availableInDMs = data.availableInDMs ?? false;
		this.#voiceRequirements = data.voiceRequirements ?? 0;
		this.#interactionTypes = data.interactionTypes ?? { command: { enabled: true } };
		this.#options = data.options;
		this.#run = data.run;
	}
}

module.exports = { Command, Response };
