module.exports = {
	id: 'ping',
	name: 'Ping',
	description: 'A simple module to respond to the ping command, to verify that the bot is online.',
	commands: [ 'ping' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('command:ping', ping);
}

function disable(service) {
	service.removeListener('command:ping', ping);
}

function ping(data) {
	this.sendMessage('Pong!', data.user.name);
}