var moment = require('moment');

module.exports = {
	id: 'ping',
	name: 'Ping',
	description: 'A simple module to respond to basic bot commands, to verify that the bot is online.',
	commands: [ 'ping', 'uptime', 'bot' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('command:ping', ping);
	service.on('command:uptime', uptime);
	service.on('command:bot', bot);
}

function disable(service) {
	service.removeListener('command:ping', ping);
	service.removeListener('command:uptime', uptime);
	service.removeListener('command:bot', bot);
}

function ping(data) {
	this.sendMessage('Pong!', data.user.name);
}

function uptime(data) {
	this.sendMessage('I have been online since ' + moment(this.uptime).fromNow() + '.', data.user.name);
}

function bot(data) {
	this.sendMessage('This bot is running BlipBot. Get your own at http://blipbot.dead-i.co.uk/', data.user.name);
}