var log = require('log4js').getLogger('SCHEDULE');
var interval = 2;
var messages = [];
var timer;

module.exports = function(service) {
	setTimer(service);

	service.on('scheduleadd', function(data) {
		if (service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			messages.push(data.ex.join(' '));
			service.sendMessage('Your message has been added to the message wheel.', data.user.name);
		}
	});

	service.on('scheduleinterval', function(data) {
		if (service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			if (isNaN(data.ex[0]) || data.ex[0] < 1) {
				return service.sendMessage('This will set the scheduler interval, in minutes.', data.user.name);
			}

			interval = data.ex[0];
			clearTimeout(timer);
			setTimer(service);
			service.sendMessage('The scheduler interval has been changed to ' + data.ex[0] + ' minutes.', data.user.name);
		}
	});
};

function setTimer(service) {
	log.info('Starting scheduler for ' + interval + ' minutes...');
	timer = setInterval(function() {
		service.sendMessage(messages[0]);
		messages.shift();
	}, interval * 60 * 1000);
}
