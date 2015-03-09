var moment = require('moment');

module.exports = {
	id: 'seen',
	name: 'Last Seen',
	description: 'This module adds a command where users can determine how long ago a particular user was seen speaking in the channel.',
	commands: [ 'lastseen <username>' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.userTimes = {};
	service.on('data', dataHandler);
	service.on('command:lastseen', lastSeen);
}

function disable(service) {
	service.removeListener('command:lastseen', lastSeen);
}

function dataHandler(data) {
	this.userTimes[data.user.name] = new Date().getTime();
}

function lastSeen(data) {
	if (data.ex.length < 1) {
		return this.sendMessage('This will display how long a user has been idle for.', data.user.name);
	}

	var user = data.ex[0];
	if (user.substring(0, 1) == '@') {
		user = user.substring(1);	
	}

	for (var name in this.userTimes) {
		if (name.toLowerCase() == user.toLowerCase()) {
			return this.sendMessage('I last saw @' + name + ' ' + moment(this.userTimes[name]).fromNow(), data.user.name);
		}
	}

	this.sendMessage('I have not seen @' + user + ' speak recently.', data.user.name);
}