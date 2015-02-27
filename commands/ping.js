module.exports = function(service) {
	service.on('ping', function(data) {
		service.sendMessage('Pong!', data.user.name);
	});
	
	return {
		id: 'ping',
		name: 'Ping',
		description: 'A simple module to respond to the ping command, to verify that the bot is online.'
	};
};