var log = require('log4js').getLogger('RAFFLE');
var users = [];
var term = null;

module.exports = function(service) {
	service.on('data', function(data) {
		if (term && users.indexOf(data.user.name) == -1 && data.msg.indexOf(term) != -1) {
			log.info('Entering ' + data.user.name + ' into the draw.');
			users.push(data.user.name);
		}
	});
	
	service.on('raffleset', function(data) {
		if (service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			users = [];
			term = data.ex[0] || '';
			service.sendMessage('Any users who say ' + (term == '' ? 'anything' : term) + ' will be entered into the raffle.', data.user.name);
		}
	});
	
	service.on('raffleend', function(data) {
		if (service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			if (users.length == 0) {
				return service.sendMessage('Nobody entered the raffle this time. Awh. :(', data.user.name);	
			}
			
			service.sendMessage('@' + users[Math.floor(Math.random() * users.length)] + ' has been randomly drawn.');
			users = [];
			term = null;
		}
	});
};