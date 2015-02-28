module.exports = {
	id: 'clear',
	name: 'Clear Chat',
	description: 'This will allow moderators to clear large numbers of messages from the channel. They can clear a specific user\'s chat, or the entire channel.',
	commands: [ 'clear <username>', 'clearall' ],
	enable: enable,
	disable: disable,
};

function enable(service) {
	service.on('command:clear', clear);
	service.on('command:clearall', clearAll);
}

function disable(service) {
	service.removeListener('command:clear', clear);
	service.removeListener('command:clearall', clearAll);
}

function clear(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}

	if (data.ex.length < 1) {
		return this.sendMessage('This will clear a user\'s chat. You must specify the user to clear.', data.user.name);
	}
	
	var self = this;
	this.messages.forEach(function(data) {
		if (data.user.name == data.ex[0]) {
			self.deleteMessage(data.id);
		}
	});

	this.sendMessage('The user\'s chat has been cleared.', data.user.name);
}

function clearAll(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	var self = this;
	this.messages.forEach(function(data) {
		self.deleteMessage(data.id);
	});

	this.sendMessage('The channel chat has been cleared.', data.user.name);
}