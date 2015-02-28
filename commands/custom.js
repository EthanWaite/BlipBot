module.exports = {
	id: 'custom',
	name: 'Custom Messages',
	description: 'This allows moderators to define custom commands, which will display a message of their choice.',
	commands: [ 'set <name> <message>' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	setupCommands(service);
	service.on('command:set', set);
}

function disable(service) {
	service.removeListener('command:set', set);
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