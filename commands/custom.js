module.exports = function(service) {
	setupCommands(service);
	
	service.on('set', function(data) {
		if (!service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			return;
		}
		
		if (service.listeners(data.ex[0]).length > 0) {
			return service.sendMessage('You cannot override a predefined command.', data.user.name);	
		}
		
		service.db.collection('commands').insert({ channel: service.cid, name: data.ex[0], content: data.ex.slice(1).join(' ') }, function(err) {
			if (err) {
				throw err;
			}
			
			service.sendMessage('Command !' + data.ex[0] + ' has been set.', data.user.name);
			setupCommands(service);
		});
	});
};

function setupCommands(service) {
	service.db.collection('commands').find({ channel: service.cid }).toArray(function(err, rows) {
		if (err) {
			throw err;
		}
		
		rows.forEach(function(row) {
			service.removeAllListeners();
			service.on(row.name, function(data) {
				service.sendMessage(row.content, data.ex[0] || data.user.name);
			});
		});
	});
}