var mongodb = require('mongodb');
var log = require('log4js').getLogger('CUSTOM');

module.exports = {
	id: 'custom',
	name: 'Custom Messages',
	description: 'This allows moderators to define custom commands, which will display a message of their choice.',
	commands: [ 'set <name> <message>', 'unset <name>' ],
	enable: enable,
	disable: disable,
	config: config,
	add: add,
	remove: remove
};

function enable(service) {
	setupCommands(service);
	service.on('command:set', set);
	service.on('command:unset', unset);
}

function disable(service) {
	service.removeListener('command:set', set);
	service.removeListener('command:unset', unset);
}

function config(service, cb) {
	service.db.collection('commands').find({ service: service.id }).toArray(function(err, rows) {
		var items = [];
		rows.forEach(function(row) {
			items.push({ id: row._id, content: '!' + row.name + ': ' + row.content });
		});
		
		cb({
			title: 'Custom messages',
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
	db.collection('commands').insert({ service: service.id, name: parseCommand(data.name), content: data.message }, function(err) {
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
			return cb();	
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
	if (!this.requireRole([ 'mod', 'owner', 'blipbot' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 2) {
		return this.sendMessage('This creates a new custom command.', data.user.name);
	}
	
	var command = parseCommand(data.ex[0]);
	
	var self = this;
	this.db.collection('commands').count({ service: this.id, name: command }, function(err, count) {
		if (err) {
			throw err;
		}
		
		if (count == 0 && self.listeners('command:' + command).length > 0) {
			return self.sendMessage('You cannot override a predefined command.', data.user.name);
		}
		
		self.db.collection('commands').update({ service: self.id, name: command }, { service: self.id, name: command, content: data.ex.slice(1).join(' ') }, { upsert: true }, function(err) {
			if (err) {
				throw err;
			}

			self.sendMessage('Command !' + command + ' has been set.', data.user.name);
			setupCommands(self);
		});
	});
}

function unset(data) {
	if (!this.requireRole([ 'mod', 'owner', 'blipbot' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This removes a custom command you have already defined.', data.user.name);
	}
	
	var command = parseCommand(data.ex[0]);
	
	var self = this;
	this.db.collection('commands').remove({ service: self.id, name: command }, function(err, res) {
		if (err) {
			throw err;
		}
		
		if (res == 0) {
			return self.sendMessage('This command is not set as a custom command.', data.user.name);
		}
		
		self.sendMessage('Command !' + command + ' has been removed.', data.user.name);
		self.removeAllListeners('command:' + command);
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
				var content = row.content;
				for (var i = 1;; i++) {
					var value = '%' + i + '%';
					if (content.indexOf(value) == -1) {
						break;
					}
					
					if (data.ex.length < i) {
						return;	
					}
					
					content = content.replace(new RegExp(value, 'g'), data.ex[i - 1]);
				}
				content = content.replace(/%%/g, data.ex.join(' '));
				
				service.sendMessage(content, data.ex[i - 1] || data.user.name);
			});
		});
	});
}

function parseCommand(command) {
	command = command.toLowerCase();
	if (command.indexOf('!') == 0) {
		return command.substring(1);	
	}
	return command;
}