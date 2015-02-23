module.exports = function(service) {	
	service.on('clear', function(data) {
		if (!service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			return;
		}

		if (data.ex.length < 1) {
			return service.sendMessage('This will clear a user\'s chat. You must specify the user to clear.', data.user.name);
		}

		service.messages.forEach(function(data) {
			if (data.user.name == data.ex[0]) {
				service.deleteMessage(data.id);
			}
		});

		service.sendMessage('The user\'s chat has been cleared.', data.user.name);
	});

	service.on('clearall', function(data) {
		if (!service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			return;
		}

		service.messages.forEach(function(data) {
			service.deleteMessage(data.id);
		});

		service.sendMessage('The channel chat has been cleared.', data.user.name);
	});
};
