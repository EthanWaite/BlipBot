var blacklist = [ 'cake', 'cookie' ];

module.exports = {
	id: 'filter',
	name: 'Chat Filter',
	description: 'This automatically deletes and eventually punishes users for messages with bad language or too mnay capital letters in their messages.',
	commands: [],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('data', dataHandler);
}

function disable(service) {
	service.removeListener('data', dataHandler);
}

function dataHandler(data) {
	var self = this;
	if (data.msg.length > 5 && !this.hasRole([ 'mod', 'owner' ], data.user.role)) {
		var caps = 0;
		for (var i = 0; i < data.msg.length; i++) {
			if (/[A-Z]/.test(data.msg[i])) {
				caps++;
			}
		}

		if ((caps / data.msg.length * 100) > 50) {
			this.deleteMessage(data.id, function() {
				self.sendMessage('Please stop speaking in all-caps.', data.user.name);	
			});
		}
	}

	for (var i in blacklist) {
		if (data.msg.toLowerCase().indexOf(blacklist[i]) != -1) {
			this.deleteMessage(data.id, function() {
				self.addWarning(data.user, 'bad language', function(warnings, max) {
					self.sendMessage('Watch your language. (warning ' + warnings + '/' + max + ')', data.user.name);
				});
			});
			break;
		}
	}
}