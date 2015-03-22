var moment = require('moment');

module.exports = {
	id: 'clear',
	name: 'Moderation Commands',
	description: 'This will add extra commands to help moderators in the channel. They can warn users, and clear large numbers of messages from the channel.',
	commands: [ 'warn <username> [reason]', 'mute <username> [expiry]', 'unmute <username>', 'clear <username>', 'clearall', 'chatlock' ],
	enable: enable,
	disable: disable,
};

function enable(service) {
	service.on('command:warn', warn);
	service.on('command:mute', mute);
	service.on('command:ban', mute);
	service.on('command:unmute', unmute);
	service.on('command:unban', unmute);
	service.on('command:clear', clear);
	service.on('command:clearall', clearAll);
	service.on('command:chatlock', chatLock);
	service.on('data', dataHandler);
}

function disable(service) {
	service.removeListener('command:warn', warn);
	service.removeListener('command:mute', mute);
	service.removeListener('command:ban', mute);
	service.removeListener('command:unmute', unmute);
	service.removeListener('command:unban', unmute);
	service.removeListener('command:clear', clear);
	service.removeListener('command:clearall', clearAll);
	service.removeListener('command:chatlock', chatLock);
	service.removeListener('data', dataHandler);
}

function warn(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This command warns the user specified. Once the user has hit the warning threshold, they will be muted.');
	}
	
	var self = this;
	this.getUser(data.ex[0], function(err, user) {
		if (err) {
			return log.warn(err);
		}
		
		if (!user) {
			return self.sendMessage('The user you have specified does not exist.', data.user.name);
		}
		
		self.addWarning({ id: user.id, name: user.username }, (data.ex.length > 1 ? data.ex.slice(1).join(' ') + ' ' : '') + '(' + data.user.name + ')', function(warnings, max) {
			self.sendMessage('You have been given a warning by a moderator. Warning ' + warnings + '/' + max, user.username);
		});
	});
}

function mute(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This command mutes the user specified, so they will be able to speak in chat. Bans can be permanent or timed. For example, /ban user 2 hours', data.user.name);
	}
	
	var time = null;
	if (data.ex.length > 1) {
		var offset = {};
		var params = data.ex.slice(1);
		for (var i = 0; i < params.length; i++) {
			if (!isNaN(params[i]) && isNaN(params[i + 1]) && params.length > i + 1) {
				offset[params[i + 1]] = params[i];
			}
		}
		var date = moment().add(offset);
		time = date.unix();
		
		if ((time - moment().unix()) < 60) {
			return this.sendMessage('The ban\'s expiry must be at least 1 minute.', data.user.name);
		}
	}
	
	var self = this;
	this.banUser(data.ex[0], time, function() {
		self.sendMessage('The user @' + data.ex[0] + ' has been muted' + (time ? ', and will be unmuted ' + date.from(new Date()) : ' permanently') + '.', data.user.name);
	});
}

function unmute(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This command will unban the user specified.', data.user.name);
	}
	
	var self = this;
	this.unbanUser(data.ex[1], function() {
		self.sendMessage('The user @' + data.ex[0] + ' has been unmuted.', data.user.name);
	});
}

function clear(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}

	if (data.ex.length < 1) {
		return this.sendMessage('This will clear a user\'s chat. You must specify the user to clear.', data.user.name);
	}
	
	var self = this;
	this.messages.forEach(function(msg) {
		if (msg.user.name == data.ex[0]) {
			self.deleteMessage(msg.id);
		}
	});

	this.sendMessage('The user\'s chat has been cleared.', data.user.name);
}

function clearAll(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	var self = this;
	this.messages.forEach(function(msg) {
		self.deleteMessage(msg.id);
	});

	this.sendMessage('The channel chat has been cleared.', data.user.name);
}

function chatLock(data) {
	if (!this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		return;
	}
	
	if ('chatLockStatus' in this && this.chatLockStatus) {
		this.chatLockStatus = false;
		this.sendMessage('The chat lock has been removed.', data.user.name);
		clearTimeout(this.chatLockWarning);
	}else{
		this.chatLockStatus = true;
		this.sendMessage('The chat lock has been enabled. Only moderators, the channel owner, and Beam staff can speak.', data.user.name);
		
		var self = this;
		this.chatLockWarning = setInterval(function() {
			self.sendMessage('Only staff can speak at this time. Moderators can use !chatlock to disable this.', data.user.name);
		}, 60000);
	}
}

function dataHandler(data) {
	if ('lockdown' in this && this.lockdown && [ 'Mod', 'Owner', 'Developer', 'Admin' ].indexOf(data.user.role) == -1) {
		this.deleteMessage(data.id);
	}
}