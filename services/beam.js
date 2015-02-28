var events = require('events').EventEmitter;
var util = require('util');
var request = require('request');
var websocket = require('ws');
var ent = require('ent');
var log = require('log4js').getLogger('BEAM');

var agent = 'Mozilla/5.0 (compatible; BlipBot/1.0)';

module.exports = beam = function(db, config, id, channel) {
	this.db = db;
	this.config = config;
	this.id = id;
	this.channel = channel;
	this.messages = [];
	this.warnings = {};
	this.maxwarnings = 5;
	
	events.call(this);
	
	var self = this;
	self.getAuth(config.username, config.password, function(id) {
		self.getChannel(channel, function(channel) {
			self.cid = channel.id;
			self.getSocket(id);
		});
	});
};

util.inherits(beam, events);

beam.prototype.getAuth = function(username, password, cb) {
	this.query('post', 'users/login', { username: username, password: password }, function(err, res, body) {
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

beam.prototype.getSocket = function(user, endpoint) {
	if (endpoint === undefined) {
		endpoint = 0;	
	}
	
	var self = this;
	this.query('get', 'chats/' + self.cid, null, function(err, res, body) {
		var data = JSON.parse(body);
		
		var endpoints = JSON.parse(body).endpoints;
		if (endpoint >= endpoints.length) {
			endpoint = 0;
		}
		var server = endpoints[endpoint];
		
		log.info('Connecting to web socket at ' + server + ' (endpoint ' + endpoint + ')...');
		socket = new websocket(server, { headers: { 'User-Agent': agent } });
		
		socket.on('open', function() {
			socket.send(JSON.stringify({ type: 'method', method: 'auth', arguments: [ self.cid, user, data.authkey ] }));
		});
		
		socket.on('error', function(err) {
			log.warn(err);
		});
		
		socket.on('close', function() {
			log.warn('Lost connection to Beam. Re-attempting connection in 3 seconds...');
			setTimeout(function() {
				self.getSocket(user, endpoint + 1);
			}, 3000);
		});
		
		socket.on('message', function(data) {
			log.debug('Raw: ' + data);
			data = JSON.parse(data);
			if (data.type == 'event' && data.event == 'ChatMessage' && data.data.user_name != self.config.username) {
				var text = self.parseMessage(data.data.message);
				var message = {
					service: 'beam',
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
	this.db.collection('warnings').find({ service: this.id, user: user.id, expired: false }).count(function(err, count) {
		if (err) {
			throw err;
		}
		cb(count);
	});
};

beam.prototype.addWarning = function(user, reason, cb) {
	log.warn('Adding warning...');
	var self = this;
	this.db.collection('warnings').insert({ service: this.id, user: user.id, name: user.name, time: new Date().getTime(), reason: reason, expired: false }, function(err) {
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
	this.db.collection('warnings').update({ service: this.id, user: user.id }, { $set: { expired: true } }, { multi: true }, function(err) {
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
	if (socket.readyState != 1) {
		return log.warn('Discarding message, as connection is offline.');	
	}
	
	if (recipient !== undefined) {
		msg = (recipient.substring(0, 1) != '@' ? '@' : '') + recipient + ' ' + msg;	
	}
	
	socket.send(JSON.stringify({ type: 'method', method: 'msg', arguments: [ msg ] }));
};

beam.prototype.deleteMessage = function(id, cb) {
	log.info('Deleting message with id ' + id + '.');
	this.query('delete', 'chats/' + this.cid + '/message/' + id, {}, cb);
};

beam.prototype.banUser = function(user, cb) {
	log.warn('Banning user ' + user.name + '.');
	this.query('put', 'chats/' + this.cid + '/ban/' + user.name, {}, cb);
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
		if (self.listeners('command:' + command).length > 0) {
			data.ex.shift();
			this.deleteMessage(data.id, function() {
				self.emit('command:' + command, data);
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