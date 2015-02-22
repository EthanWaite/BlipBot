var commands = {};

module.exports = function(service) {
	setupCommands(service);
	
	service.on('set', function(data) {
		if (!service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			return;
		}
		
		if (!(data.ex[0] in commands) && service.listeners(data.ex[0]).length > 0) {
			return service.sendMessage('You cannot override a predefined command.', data.user.name);	
		}
		
		commands[data.ex[0]] = data.ex.slice(1).join(' ');
		service.sendMessage('Command !' + data.ex[0] + ' has been set.', data.user.name);
		setupCommands(service);
	});
};

function setupCommands(service) {
	for (var key in commands) {
		service.removeAllListeners(key);
		service.on(key, function(data) {
			service.sendMessage(commands[key], data.ex[0] || data.user.name);
		});
	}
}