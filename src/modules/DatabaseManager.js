const { MongoClient } = require('mongodb');

class DatabaseManager {
	#databaseName;
	#client;

	/**
	 * @param {import('../bot').Bot} bot - Bot instance
	 * @param {string} mongoConnectionString - Connection string
	 */
	constructor(bot, mongoConnectionString) {
		this.#databaseName = bot.config.databaseName;
		this.#client = new MongoClient(mongoConnectionString);
	}

	connect() {
		return this.#client.connect();
	}

	async insertOne(collection, document) {
		await this.#client.db(this.#databaseName).collection(collection).insertOne(document);
	}

	async insertMany(collection, documents) {
		await this.#client.db(this.#databaseName).collection(collection).insertMany(documents);
	}

	collectionLength(collection) {
		return this.#client.db(this.#databaseName).collection(collection).countDocuments();
	}

	findOne(collection, filter = {}, withDocumentID = false) {
		return this.#client.db(this.#databaseName).collection(collection).findOne(filter, {
			projection: withDocumentID ? {} : { _id: 0 },
		});
	}

	findMany(collection, filter = {}, sort = {}, limit = null, skip = 0, withDocumentID = false) {
		return this.#client.db(this.#databaseName).collection(collection).find(filter, {
			sort: sort,
			limit: limit,
			skip: skip,
			projection: withDocumentID ? {} : { _id: 0 },
		}).toArray();
	}

	async updateOne(collection, filter, changes) {
		await this.#client.db(this.#databaseName).collection(collection).updateOne(filter, { $set: changes });
	}

	async updateMany(collection, filter, changes) {
		await this.#client.db(this.#databaseName).collection(collection).updateMany(filter, { $set: changes });
	}

	async removeOne(collection, filter) {
		await this.#client.db(this.#databaseName).collection(collection).deleteOne(filter);
	}

	removeMany(collection, filter) {
		return this.#client.db(this.#databaseName).collection(collection).deleteMany(filter);
	}

	createIndex(collection, index) {
		return this.#client.db(this.#databaseName).collection(collection).createIndex(index);
	}
}

module.exports = { DatabaseManager };
