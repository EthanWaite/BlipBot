var log = require('log4js').getLogger('CUSTOM');

module.exports = {
	id: 'follow',
	name: 'Follower Greeting',
	description: 'This will automatically run a predefined message when someone follows the channel.',
	commands: [ 'setfollow <message>'],
	enable: enable,
	disable: disable,
	config: config
};

function enable(service, config) {
	service.followMessage = config.message;
	service.on('follow', follow);
	service.on('command:setfollow', set);
}

function disable(service) {
	service.removeListener('follow', follow);
}

function config(service, cb) {
	cb({
		config: [
			{
				label: 'Chat message',
				id: 'message',
				type: 'text',
				default: ''
			}
		]
	});
}

function set(data) {
	if (!this.requireRole([ 'mod', 'owner', 'blipbot' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This changes the follower greeting message.', data.user.name);
	}
	
	var self = this;
	var message = data.ex.join(' ');
	this.db.collection('modules').update({ service: this.id, module: 'follow' }, { $set: { config: { message: message } } }, function(err) {
		if (err) {
			return log.warn(err);
		}
		
		self.followMessage = message;
		return self.sendMessage('The follower greeting has been changed.', data.user.name);
	});
}

function follow(user) {
	if (this.followMessage && this.followMessage.length > 0) {
		this.sendMessage(this.followMessage.replace(/%username%/g, user.username));	
	}
}