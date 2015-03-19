var mongodb = require('mongodb');

module.exports = {
	id: 'filter',
	name: 'Chat Filter',
	description: 'This automatically deletes and eventually punishes users for messages with bad language or overuse of caps in their messages.',
	commands: [],
	enable: enable,
	disable: disable,
	config: config,
	add: add,
	remove: remove
};

function enable(service, config) {
	service.filter = config;
	service.on('data', dataHandler);
	setWords(service);
}

function disable(service) {
	service.removeListener('data', dataHandler);
}

function config(service, cb) {
	service.db.collection('badwords').find({ service: service.id }).toArray(function(err, rows) {
		var items = [];
		rows.forEach(function(row) {
			items.push({ id: row._id, content: row.word });
		});
		
		cb({
			title: 'Blocked words',
			items: items,
			fields: [
				{
					label: 'Blocked word',
					id: 'word'
				}
			],
			config: [
				{
					label: 'Bad words',
					id: 'badwords',
					type: 'checkbox'
				},
				{
					label: 'Capital letters',
					id: 'caps',
					type: 'checkbox'
				},
				{
					label: 'Emoticons',
					id: 'emoticons',
					type: 'checkbox'
				}
			],
		});
	});
}

function add(service, db, data, cb) {
	db.collection('badwords').insert({ service: service.id, word: data.word }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setWords(service);
		cb();
	});
}

function remove(service, db, data, cb) {
	db.collection('badwords').remove({ service: service.id, _id: new mongodb.ObjectID(data.message) }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setWords(service);
		cb();
	});
}

function dataHandler(data) {
	if (this.hasRole([ 'mod', 'owner' ], data.user.role)) {
		return;
	}
	
	var self = this;
	if ('caps' in this.filter && this.filter.caps && data.msg.length > 5) {
		var caps = 0;
		for (var i = 0; i < data.msg.length; i++) {
			if (/[A-Z]/.test(data.msg[i])) {
				caps++;
			}
		}

		if ((caps / data.msg.length * 100) > 50) {
			this.deleteMessage(data.id, function() {
				self.sendMessage('Please stop speaking in all-caps.', data.user.name);	
			});
		}
	}

	if ('badwords' in this.filter && this.filter.badwords) {
		for (var i in this.blockedWords) {
			if (data.msg.toLowerCase().indexOf(this.blockedWords[i].toLowerCase()) != -1) {
				this.deleteMessage(data.id, function() {
					self.addWarning(data.user, 'bad language', function(warnings, max) {
						self.sendMessage('Watch your language. (warning ' + warnings + '/' + max + ')', data.user.name);
					});
				});
				break;
			}
		}
	}
	
	if ('emoticons' in this.filter && this.filter.emoticons) {
		var emotes = 0;
		data.raw.forEach(function(part) {
			if (part.type == 'emoticon') {
				emotes++;
			}
		});
		if (emotes > 3) {
			this.deleteMessage(data.id, function() {
				self.addWarning(data.user, 'excessive emoticons', function(warnings, max) {
					self.sendMessage('Please avoid excessively using emoticons. (warning ' + warnings + '/' + max + ')', data.user.name);
				});
			});
		}
	}
}

function setWords(service) {
	service.db.collection('badwords').find({ service: service.id }).toArray(function(err, rows) {
		service.blockedWords = [];
		rows.forEach(function(row) {
			service.blockedWords.push(row.word);
		});
	});
}