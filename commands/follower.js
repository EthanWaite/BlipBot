var log = require('log4js').getLogger('CUSTOM');

module.exports = {
	id: 'follow',
	name: 'Follower Greeting',
	description: 'This will automatically run a predefined message when someone follows the channel.',
	commands: [],
	enable: enable,
	disable: disable,
	config: config
};

function enable(service, config) {
	service.followMessage = config.message;
	service.on('follow', follow);
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

function follow(user) {
	if (this.followMessage && this.followMessage.length > 0) {
		this.sendMessage(this.followMessage.replace(/%username%/g, user.username));	
	}
}