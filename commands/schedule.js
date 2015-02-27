var log = require('log4js').getLogger('SCHEDULE');
var interval = 2;
var messages = [];
var timer;

module.exports = function(service) {
	service.db.collection('schedule').find({ channel: service.cid }).toArray(function(err, rows) {
		messages = rows;
		setTimer(service);
	});
	
	service.on('scheduleadd', function(data) {
		if (service.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
			var row = { channel: service.cid, content: data.ex.join(' ') };
			service.db.collection('schedule').insert(row, function(err) {
				if (err) {
					throw err;
				}
				messages.push(data);
				setTimer(service);
				service.sendMessage('Your message has been added to the message wheel.', data.user.name);
			});
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
	
	return {
		id: 'schedule',
		name: 'Scheduler',
		description: 'This module repeatedly cycles through a set of messages.'
	};
};

function setTimer(service) {
	log.info('Starting scheduler for ' + interval + ' minutes...');
	timer = setInterval(function() {
		if (messages.length > 0) {
			service.sendMessage(messages[0].content);
			messages.shift();
		}
	}, interval * 60 * 1000);
}