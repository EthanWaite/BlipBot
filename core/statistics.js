var mongodb = require('mongodb');
var log = require('log4js').getLogger('STATSTICS');

module.exports = function() {
	initializeStatistics.call(this);
	this.on('data', dataHandler);
	setInterval(refreshStatistics.bind(this), 60 * 60 * 1000);
};

function dataHandler(data) {
	var words = data.msg.split(' ').length;
	var characters = data.msg.length;
	
	this.statistics.messages++;
	this.statistics.words += data.msg.split(' ').length;
	this.statistics.characters += data.msg.length;
	incrementUser.call(this, data, words, characters);
}

function refreshStatistics() {
	log.info('Running statistics round for the hour...');
	this.statistics.service = mongodb.ObjectID(this.id);
	
	var self = this;
	this.db.collection('statistics').insert(this.statistics, function(err) {
		if (err) {
			log.warn(err);
		}
		initializeStatistics.call(self);
	});
}

function initializeStatistics() {
	this.statistics = {
		time: Math.floor(new Date().getTime() / 1000),
		messages: 0,
		words: 0,
		characters: 0
	};
}

function incrementUser(data, words, characters) {
	this.db.collection('viewers').update({ user: data.user.id, service: mongodb.ObjectID(this.id) }, { $set: { user: data.user.id, service: mongodb.ObjectID(this.id), name: data.user.name, time: Math.floor(new Date().getTime() / 1000) }, $inc: { messages: 1, words: words, characters: characters } }, { upsert: true }, function(err) {
		if (err) {
			log.warn(err);
		}
	});
}