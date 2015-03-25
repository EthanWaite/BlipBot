var mongodb = require('mongodb');
var log = require('log4js').getLogger('SCHEDULE');

module.exports = {
	id: 'schedule',
	name: 'Scheduler',
	description: 'This module repeatedly cycles through a set of messages.',
	commands: [ 'scheduleadd <message>', 'scheduleinterval <minutes>' ],
	enable: enable,
	disable: disable,
	config: config,
	add: add,
	remove: remove
};

function enable(service, config) {
	if ('interval' in config && !isNaN(config.interval) && config.interval > 0) {
		service.scheduleInterval = config.interval; //TODO Clean up configuration storage!
	}else{
		service.scheduleInterval = 2;
	}
	
	service.scheduleMessages = [];
	service.db.collection('schedule').find({ service: service.id }).toArray(function(err, rows) {
		service.scheduleMessages = rows;
		setTimer(service);
	});
	
	service.on('command:scheduleadd', scheduleAdd);
	service.on('command:scheduleinterval', scheduleInterval);
}

function disable(service) {
	clearTimeout(service.scheduleTimer);
	service.removeListener('command:scheduleadd', scheduleAdd);
	service.removeListener('command:scheduleinterval', scheduleInterval);
}

function config(service, cb) {
	service.db.collection('schedule').find({ service: service.id }).toArray(function(err, rows) {
		var items = [];
		rows.forEach(function(row) {
			items.push({ id: row._id, content: row.content });
		});
		
		cb({
			title: 'Scheduled messages',
			items: items,
			fields: [
				{
					label: 'Your scheduled message',
					id: 'message'
				}
			],
			config: [
				{
					label: 'Interval',
					id: 'interval',
					type: 'number',
					default: 2,
				}
			],
		});
	});
}

function add(service, db, data, cb) {
	db.collection('schedule').insert({ service: service.id, content: data.message }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setTimer(service);
		cb();
	});
}

function remove(service, db, data, cb) {
	db.collection('schedule').remove({ service: service.id, _id: new mongodb.ObjectID(data.message) }, function(err) {
		if (err) {
			return log.warn(err);
		}
		setTimer(service);
		cb();
	});
}

function scheduleAdd(data) {
	if (this.requireRole([ 'mod', 'owner', 'blipbot' ], data.user.name, data.user.role)) {
		var row = { service: this.id, content: data.ex.join(' ') };
		var self = this;
		this.db.collection('schedule').insert(row, function(err) {
			if (err) {
				return log.warn(err);
			}
			self.scheduleMessages.push(data);
			setTimer(self);
			self.sendMessage('Your message has been added to the message wheel.', data.user.name);
		});
	}
}
	
function scheduleInterval(data) {
	if (this.requireRole([ 'mod', 'owner', 'blipbot' ], data.user.name, data.user.role)) {
		if (isNaN(data.ex[0]) || data.ex[0] < 1) {
			return this.sendMessage('This will set the scheduler interval, in minutes.', data.user.name);
		}

		this.scheduleInterval = data.ex[0];
		setTimer(this);
		this.sendMessage('The scheduler interval has been changed to ' + data.ex[0] + ' minutes.', data.user.name);
	}
}

function setTimer(service) {
	if (!('scheduleMessages' in service) || !('scheduleInterval' in service)) {
		return;	
	}
	
	log.info('Starting scheduler for ' + service.scheduleInterval + ' minutes...');
	clearTimeout(service.scheduleTimer);
	service.scheduleTimer = setInterval(function() {
		if (service.scheduleMessages.length > 0) {
			service.sendMessage(service.scheduleMessages[0].content);
			service.scheduleMessages.push(service.scheduleMessages.shift());
		}
	}, service.scheduleInterval * 60 * 1000);
}