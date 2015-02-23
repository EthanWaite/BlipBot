var events = require('events').EventEmitter;
var util = require('util');
var request = require('request');
var websocket = require('ws');
var ent = require('ent');
var log = require('log4js').getLogger('BEAM');

var agent = 'Mozilla/5.0 (compatible; BlipBot/1.0)';

module.exports = beam = function(db, config) {
	this.db = db;
	this.config = config;
	this.messages = [];
	this.warnings = {};
	this.maxwarnings = 2;

	events.call(this);

	var self = this;
	self.getAuth(config.beam.username, config.beam.password, function(id) {
		self.getChannel(config.beam.channel, function(channel) {
			self.channel = channel.id;
			self.getSocket(id);
		});
	});

	if(!config.debug.enabled){
		log.setLevel('INFO');
	}
};

util.inherits(beam, events);

beam.prototype.getAuth = function(username, password, cb) {
	this.query('post', 'users/login', { username: username, password: password }, function(err, res, body) {
		if(err){
			log.error('Beam authentication failed!');
			process.exit(code=0);
		}
		if(body === "Invalid username or password."){
			log.error('Invalid username or password.');
			process.exit(code=0);
		}
		log.info('Authenticated with Beam.');
		cb(JSON.parse(body).id);
	});
};

beam.prototype.getChannel = function(username, cb) {
	this.query('get', 'channels/' + username, null, function(err, res, body) {
		log.info('Retrieved channel.');
		cb(JSON.parse(body));
	});
};

beam.prototype.getSocket = function(user) {
	var self = this;
	this.query('get', 'chats/' + self.channel, null, function(err, res, body) {
		var data = JSON.parse(body);

		log.info('Connecting to web socket...');
		socket = new websocket(JSON.parse(body).endpoints[0], { headers: { 'User-Agent': agent } });

		socket.on('open', function() {
			socket.send(JSON.stringify({ type: 'method', method: 'auth', arguments: [ self.channel, user, data.authkey ] }));
		});

		socket.on('message', function(data) {
			log.debug('Raw: ' + data);
			data = JSON.parse(data);
			if (data.type == 'event' && data.event == 'ChatMessage' && data.data.user_name != self.config.beam.username) {
				var text = self.parseMessage(data.data.message);
				var message = {
					time: new Date().getTime(),
					msg: text,
					ex: text.split(' '),
					id: data.data.id,
					user: {
						id: data.data.user_id,
						name: data.data.user_name,
						role: data.data.user_role
					}
				};

				self.handleMessage(message);
				self.messages.unshift(message);
			}
		});
	});
};

beam.prototype.getWarnings = function(user, cb) {
	this.db.collection('warnings').find({ channel: this.channel, user: user.id, expired: false }).count(function(err, count) {
		if (err) {
			throw err;
		}
		cb(count);
	});
};

beam.prototype.addWarning = function(user, reason, cb) {
	log.warn('Adding warning...');
	var self = this;
	this.db.collection('warnings').insert({ channel: this.channel, user: user.id, name: user.name, time: new Date().getTime(), reason: reason, expired: false }, function(err) {
		log.debug('Callback');
		if (err) {
			throw err;
		}

		log.debug('Inserted warning.');
		self.getWarnings(user, function(warnings) {
			log.debug('Got new warnings.');
			if (warnings >= self.maxwarnings) {
				log.debug('Banning user for hitting max warnings');
				self.banUser(user);
			}
			log.debug('Sending callback');
			cb(warnings, self.maxwarnings);
		});
	});
};

beam.prototype.resetWarnings = function(user) {
	this.db.collection('warnings').update({ channel: this.channel, user: user.id }, { $set: { expired: true } }, { multi: true }, function(err) {
		throw err;
	});
};

beam.prototype.query = function(method, target, form, cb) {
	request({
		method: method,
		url: 'https://beam.pro/api/v1/' + target,
		form: form,
		jar: true,
		headers: {
			'User-Agent': agent
		}
	}, cb);
};

beam.prototype.sendMessage = function(msg, recipient) {
	if (recipient !== undefined) {
		msg = (recipient.substring(0, 1) != '@' ? '@' : '') + recipient + ' ' + msg;
	}

	socket.send(JSON.stringify({ type: 'method', method: 'msg', arguments: [ msg ] }));
};

beam.prototype.deleteMessage = function(id, cb) {
	log.info('Deleting message with id ' + id + '.');
	this.query('delete', 'chats/' + this.channel + '/message/' + id, {}, cb);
};

beam.prototype.banUser = function(user, cb) {
	log.warn('Banning user ' + user.name + '.');
	this.query('put', 'chats/' + this.channel + '/ban/' + user.name, {}, cb);
	this.resetWarnings(user);
};

beam.prototype.parseMessage = function(parts) {
	var result = '';
	parts.forEach(function(part) {
		if (part.type == 'text') {
			result = result + part.data;
		}else{
			result = result + part.text;
		}
	});
	return ent.decode(result);
};

beam.prototype.handleMessage = function(data) {
	this.emit('data', data);
	if (data.ex[0].substring(0, 1) == '!') {
		var self = this;
		var command = data.ex[0].substring(1).toLowerCase();
		if (self.listeners(command).length > 0) {
			data.ex.shift();
			this.deleteMessage(data.id, function() {
				self.emit(command, data);
			});
		}
	}
};

beam.prototype.hasRole = function(groups, role) {
	return groups.indexOf(role.toLowerCase()) != -1;
};

beam.prototype.requireRole = function(groups, sender, role) {
	var allowed = this.hasRole(groups, role);
	if (!allowed) {
		this.sendMessage('You do not have permission to use this command', sender);
	}
	return allowed;
};
