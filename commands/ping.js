var moment = require('moment');

module.exports = {
	id: 'ping',
	name: 'Ping',
	description: 'A simple module to respond to basic bot commands, to verify that the bot is online.',
	commands: [ 'ping', 'status', 'bot' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('command:ping', ping);
	service.on('command:status', uptime);
	service.on('command:uptime', uptime);
	service.on('command:bot', bot);
}

function disable(service) {
	service.removeListener('command:ping', ping);
	service.removeListener('command:status', uptime);
	service.removeListener('command:uptime', uptime);
	service.removeListener('command:bot', bot);
}

function ping(data) {
	this.sendMessage('Pong!', data.user.name);
}

function uptime(data) {
	var self = this;
	this.db.collection('services').count(function(err, channels) {
		self.db.collection('modules').count({ enabled: true }, function(err, modules) {
			self.sendMessage('I have been online since ' + moment(this.uptime).fromNow() + '. I am now in ' + channels + ' channels, with a total of ' + modules + ' modules enabled.', data.user.name);
		});
	});
}

function bot(data) {
	this.sendMessage('This bot is running BlipBot. Get your own at http://blipbot.dead-i.co.uk/', data.user.name);
}