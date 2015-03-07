var mongodb = require('mongodb');
var log = require('log4js').getLogger('CUSTOM');

module.exports = {
	id: 'custom',
	name: 'Custom Messages',
	description: 'This allows moderators to define custom commands, which will display a message of their choice.',
	commands: [ 'set <name> <message>' ],
	enable: enable,
	disable: disable,
	config: config,
	add: add,
	remove: remove
};

function enable(service) {
	setupCommands(service);
	service.on('command:set', set);
}

function disable(service) {
	service.removeListener('command:set', set);
}

function config(service, cb) {
	service.db.collection('commands').find({ service: service.id }).toArray(function(err, rows) {
		var items = [];
		rows.forEach(function(row) {
			items.push({ id: row._id, content: '!' + row.name + ': ' + row.content });
		});
		
		cb({
			items: items,
			fields: [
				{
					label: 'Command name',
					id: 'name'
				},
				{
					label: 'Custom response',
					id: 'message'
				}
			]
		});
	});
}

function add(service, db, data, cb) {
	if (data.name.indexOf('!') == 0) {
		data.name = data.name.substring(1);	
	}
	
	db.collection('commands').insert({ service: service.id, name: data.name, content: data.message }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setupCommands(service);
		cb();
	});
}

function remove(service, db, data, cb) {
	var params = { service: service.id, _id: new mongodb.ObjectID(data.message) };
	db.collection('commands').find(params).toArray(function(err, rows) {
		if (err || rows.length == 0) {
			log.warn('No rows returned when removing command.');
			cb();	
		}
		
		db.collection('commands').remove({ service: service.id, _id: new mongodb.ObjectID(data.message) }, function(err) {
			if (err) {
				return log.warn(err);
			}
			service.removeAllListeners('command:' + rows[0].name);
			cb();
		});
	});
}

function set(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 2) {
		return this.sendMessage('This creates a new custom command.', data.user.name);
	}

	if (this.listeners(data.ex[0]).length > 0) {
		return this.sendMessage('You cannot override a predefined command.', data.user.name);	
	}
	
	var self = this;
	this.db.collection('commands').insert({ service: this.id, name: data.ex[0], content: data.ex.slice(1).join(' ') }, function(err) {
		if (err) {
			throw err;
		}

		self.sendMessage('Command !' + data.ex[0] + ' has been set.', data.user.name);
		setupCommands(self);
	});
}

function setupCommands(service) {
	service.db.collection('commands').find({ service: service.id }).toArray(function(err, rows) {
		if (err) {
			throw err;
		}
		
		rows.forEach(function(row) {
			var name = 'command:' + row.name;
			service.removeAllListeners(name);
			service.on(name, function(data) {
				service.sendMessage(row.content, data.ex[0] || data.user.name);
			});
		});
	});
}