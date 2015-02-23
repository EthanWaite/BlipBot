module.exports = function(service) {
	service.on('ping', function(data) {
		service.sendMessage('Pong!', data.user.name);
	});
};
