var blacklist = [ 'cake', 'cookie' ];

module.exports = function(service) {
	service.on('data', function(data) {
		if (data.msg.length > 5 && !service.hasRole([ 'mod', 'owner' ], data.user.role)) {
			var caps = 0;
			for (var i = 0; i < data.msg.length; i++) {
				if (/[A-Z]/.test(data.msg[i])) {
					caps++;
				}
			}
			
			if ((caps / data.msg.length * 100) > 50) {
				service.deleteMessage(data.id, function() {
					service.sendMessage('Please stop speaking in all-caps.', data.user.name);	
				});
			}
		}
		
		for (var i in blacklist) {
			if (data.msg.toLowerCase().indexOf(blacklist[i]) != -1) {
				service.deleteMessage(data.id, function() {
					service.addWarning(data.user, 'bad language', function(warnings, max) {
						service.sendMessage('Watch your language. (warning ' + warnings + '/' + max + ')', data.user.name);
					});
				});
				break;
			}
		}
	});
	
	return {
		id: 'filter',
		name: 'Chat Filter',
		description: 'This automatically deletes and eventually punishes users for messages with bad language or too mnay capital letters in their messages.'
	};
};