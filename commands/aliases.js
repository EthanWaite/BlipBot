var mongodb = require('mongodb');
var log = require('log4js').getLogger('CUSTOM');

module.exports = {
	id: 'aliases',
	name: 'Aliases',
	description: 'This allows moderators to simply create aliases for other commands.',
	commands: [ 'addalias <alias> <command>' ],
	enable: enable,
	disable: disable,
	config: config,
	add: add,
	remove: remove
};

function enable(service) {
	setupCommands(service);
	service.on('command:addalias', add);
}

function disable(service) {
	service.removeListener('command:addalias', add);
}

function config(service, cb) {
	service.db.collection('aliases').find({ service: service.id }).toArray(function(err, rows) {
		var items = [];
		rows.forEach(function(row) {
			items.push({ id: row._id, content: '!' + row.alias + ' resolves to !' + row.command });
		});
		
		cb({
			items: items,
			fields: [
				{
					label: 'Alias name',
					id: 'alias'
				},
				{
					label: 'Command name',
					id: 'command'
				}
			]
		});
	});
}

function add(service, db, data, cb) {
	db.collection('aliases').insert({ service: service.id, alias: parseCommand(data.alias), command: parseCommand(data.command) }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setupCommands(service);
		cb();
	});
}

function remove(service, db, data, cb) {
	var params = { service: service.id, _id: new mongodb.ObjectID(data.message) };
	db.collection('aliases').find(params).toArray(function(err, rows) {
		if (err || rows.length == 0) {
			log.warn('No rows returned when removing command.');
			cb();	
		}
		
		db.collection('aliases').remove({ service: service.id, _id: new mongodb.ObjectID(data.message) }, function(err) {
			if (err) {
				return log.warn(err);
			}
			service.removeAllListeners('command:' + rows[0].alias);
			cb();
		});
	});
}

function add(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 2) {
		return this.sendMessage('This creates a new alias to another command.', data.user.name);
	}

	if (this.listeners(data.ex[0]).length > 0) {
		return this.sendMessage('You cannot override a predefined command.', data.user.name);	
	}
	
	var alias = parseCommand(data.ex[0]);
	var command = parseCommand(data.ex[1]);
	
	var self = this;
	this.db.collection('aliases').insert({ service: this.id, alias: alias, command: command }, function(err) {
		if (err) {
			throw err;
		}

		self.sendMessage('Command !' + alias + ' has been linked to !' + command + '.', data.user.name);
		setupCommands(self);
	});
}

function setupCommands(service) {
	service.db.collection('aliases').find({ service: service.id }).toArray(function(err, rows) {
		if (err) {
			throw err;
		}
		
		rows.forEach(function(row) {
			var name = 'command:' + row.alias;
			service.removeAllListeners(row.alias);
			service.on(name, function(data) {
				service.emit('command:' + row.command, data);
			});
		});
	});
}

function parseCommand(command) {
	if (command.indexOf('!') == 0) {
		return command.substring(1);	
	}
	return command;
}