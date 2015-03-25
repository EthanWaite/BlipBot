var events = require('events').EventEmitter;
var util = require('util');
var request = require('request');
var websocket = require('ws');
var ent = require('ent');
var mongodb = require('mongodb');
var log = require('log4js').getLogger('BEAM');

var agent = 'Mozilla/5.0 (compatible; BlipBot/1.0)';

module.exports = beam = function(config, db, id, channel, cb) {
	this.config = config;
	this.db = db;
	this.id = id;
	this.channel = channel;
	this.reconnect = true;
	this.messages = [];
	this.followers = [];
	this.bypass = [];
	this.uses = {};
	this.warnings = {};
	this.maxwarnings = 5;
	
	events.call(this);
	setInterval(this.checkBans.bind(this), 60000);
};

util.inherits(beam, events);

beam.prototype.connect = function(data, cb) {
	var self = this;
	this.getChannel(this.channel, function(err, channel) {
		if (err) {
			if (cb !== undefined) {
				cb(err);
			}
			return log.warn(err);
		}

		self.cid = channel.id;
		self.connectLive();
		self.connectChat(data);
	});
};

beam.prototype.getAuth = function(data, cb) {
	log.info('Authenticating with Beam as ' + data.username + '...');
	this.query('post', 'users/login', { username: data.username, password: data.password }, function(err, res, body) {
		if (err) {
			return cb(err);
		}
		
		if (res.statusCode != 200) {
			log.warn('Received status code ' + res.statusCode + ' while authenticating.');
			return cb(new Error('invalid status code'));	
		}
		
		log.info('Authenticated with Beam.');
		cb(null, JSON.parse(body).id);
	});
};

beam.prototype.getChannel = function(username, cb) {
	this.query('get', 'channels/' + username, null, function(err, res, body) {
		if (err) {
			return cb(err);
		}
		
		if (res.statusCode == 404) {
			return cb(new Error('channel does not exist'));	
		}
		
		if (res.statusCode != 200) {
			return cb(new Error('invalid status code ' + res.statusCode));
		}
		
		log.info('Retrieved channel.');
		cb(null, JSON.parse(body));
	});
};

beam.prototype.connectLive = function() {
	var self = this;
	self.call = 420;
	
	log.info('Connecting to live web socket...');
	var socket = new websocket('https://beam.pro/socket.io/?__sails_io_sdk_version=0.11.0&__sails_io_sdk_platform=node&__sails_io_sdk_language=javascript&EIO=3&transport=websocket', { headers: { 'User-Agent': agent } });
	
	var timeout = setInterval(function() {
		if (socket.readyState == 1) {
			socket.send('2');	
		}
	}, 25000);
	
	socket.on('message', function(data) {
		var slug = 'channel:' + self.cid;
		if (data == '40') {
			socket.send(self.call++ + JSON.stringify([ 'put', { method: 'put', headers: {}, data: { slug: [ slug + ':followed', slug + ':status' ] }, url: '/api/v1/live' }]));
		}else{
			var index = data.substring(0, 3).indexOf('[');
			if (index != -1) {
				var event = JSON.parse(data.substring(index));
				if (event[0] == slug + ':followed' && event[1].following && self.followers.indexOf(event[1].user.id) == -1) {
					log.info('New follower in channel ' + self.channel + ': ' + event[1].user.username);
					self.followers.push(event[1].user.id);
					self.emit('follow', event[1].user);
				}
				
				if (event[0] == 'chat:' + self.cid + ':StartStreaming') {
					self.emit('online');
				}
			}
		}
	});
	
	socket.on('error', function(err) {
		log.warn(err);
	});

	socket.on('close', function() {
		if (self.reconnect) {
			log.warn('Lost connection to Beam. Attempting reconnection in 3 seconds...');
			setTimeout(self.connectLive.call(self), 3000);
			clearTimeout(timeout);
		}
	});
	
	self.live = socket;
};

beam.prototype.connectChat = function(user, endpoint) {
	if (endpoint === undefined) {
		endpoint = 0;	
	}
	
	var self = this;
	this.query('get', 'chats/' + self.cid, null, function(err, res, body) {
		if (err || res.statusCode != 200) {
			log.warn('Invalid status code returned by Beam. Retrying in 3 seconds...');
			setTimeout(function() {
				self.connectChat(user);
			}, 3000);
			return;
		}
		
		var data = JSON.parse(body);
		
		if (!('endpoints' in data) && data.endpoints.length == 0) {
			return log.warn('No endpoints available.');
		}
		
		var endpoints = data.endpoints;
		if (endpoint >= endpoints.length) {
			endpoint = 0;
		}
		var server = endpoints[endpoint];
		
		log.info('Connecting to chat web socket at ' + server + ' (endpoint ' + endpoint + ')...');
		var socket = new websocket(server, { headers: { 'User-Agent': agent } });
		
		socket.on('open', function() {
			self.uptime = new Date().getTime();
			socket.send(JSON.stringify({ type: 'method', method: 'auth', arguments: [ self.cid, user, data.authkey ] }));
		});
		
		socket.on('error', function(err) {
			log.warn(err);
		});
		
		socket.on('close', function() {
			if (self.reconnect) {
				log.warn('Lost connection to chat server. Re-attempting connection in 3 seconds...');
				setTimeout(function() {
					self.connectChat(user, endpoint + 1);
				}, 3000);
			}
		});
		
		socket.on('message', function(data) {
			//log.debug('Raw: ' + data);
			data = JSON.parse(data);
			
			if (data.type == 'reply' && data.error == null && 'authenticated' in data.data && data.data.authenticated) {
				self.emit('connected');	
			}
			
			if (data.type == 'event') {
				if (data.event == 'UserUpdate' && data.data.username == self.config.username && data.data.role == 'Mod') {
					self.emit('authenticated');
				}else if (data.event == 'ChatMessage') {
					if (data.data.user_name == self.config.username) {
						if (data.data.user_role == 'Owner') {
							self.emit('authenticated');	
						}
					}else{
						var text = self.parseMessage(data.data.message);
						var message = {
							service: 'beam',
							time: new Date().getTime(),
							msg: text,
							ex: text.split(' '),
							raw: data.data.message,
							id: data.data.id,
							user: {
								id: data.data.user_id,
								name: data.data.user_name,
								role: data.data.user_role
							}
						};
						
						log.info('Message in ' + self.channel + ' from ' + message.user.name + ': ' + text);
						self.handleMessage(message);
						self.messages.unshift(message);
					}
				}
			}
		});
		
		self.socket = socket;
	});
};

beam.prototype.disconnect = function() {
	log.info('Disconnecting from ' + this.channel + '.');
	this.reconnect = false;
	if ('socket' in this && this.socket.readyState == 1) {
		this.socket.close();
	}
};

beam.prototype.getUser = function(username, cb) {
	this.query('get', 'channels/' + username, null, function(err, res, body) {
		if (err) {
			return cb(err);
		}
		
		if (res.statusCode == 404) {
			return cb();
		}
		
		if (res.statusCode != 200) {
			return cb(new Error('unable to retrieve user ID from Beam'));
		}
		
		cb(null, JSON.parse(body).user);
	});
};

beam.prototype.getWarnings = function(user, cb) {
	log.info('Retrieving warnings for user ' + user.name + '...');
	this.db.collection('warnings').find({ service: this.id, user: user.id, expired: false }).count(function(err, count) {
		if (err) {
			throw err;
		}
		cb(count);
	});
};

beam.prototype.addWarning = function(user, reason, cb) {
	log.info('Adding warning for user ' + user.name + '...');
	var self = this;
	this.db.collection('warnings').insert({ service: this.id, user: user.id, name: user.name, reason: reason, expired: false }, function(err) {
		log.debug('Callback!');
		if (err) {
			throw err;
		}
		
		log.debug('Inserted warning.');
		self.getWarnings(user, function(warnings) {
			log.debug('Got new warnings.');
			if (warnings >= self.maxwarnings) {
				log.debug('Banning user for hitting max warnings');
				self.banUser(user.name);
				self.resetWarnings(user);
			}
			log.debug('Sending callback');
			cb(warnings, self.maxwarnings);
		});
	});
};

beam.prototype.resetWarnings = function(user) {
	log.info('Resetting warnings for user ' + user.name + '...');
	this.db.collection('warnings').update({ service: this.id, user: user.id }, { $set: { expired: true } }, { multi: true }, function(err) {
		if (err) {
			throw err;
		}
	});
};

beam.prototype.query = function(method, target, form, cb) {
	request({
		method: method,
		url: 'https://beam.pro' + (target.substring(0, 1) == '/' ? '' : '/api/v1/') + target,
		form: form,
		jar: true,
		headers: {
			'User-Agent': agent
		}
	}, cb);
};

beam.prototype.sendMessage = function(msg, recipient) {
	if (!('socket' in this) || this.socket.readyState != 1) {
		return log.warn('Discarding message, as connection is offline.');	
	}
	
	if (recipient !== undefined) {
		msg = (recipient.substring(0, 1) != '@' ? '@' : '') + recipient + ' ' + msg;	
	}
	
	log.info('Sending message to ' + this.channel + ': ' + msg);
	this.socket.send(JSON.stringify({ type: 'method', method: 'msg', arguments: [ msg ] }));
};

beam.prototype.deleteMessage = function(id, cb) {
	log.info('Deleting message with id ' + id + '.');
	this.query('delete', 'chats/' + this.cid + '/message/' + id, {}, cb);
};

beam.prototype.banUser = function(user, expiry, cb) {
	log.warn('Banning user ' + user + ' ' + (expiry ? 'until ' + expiry : 'forever') + '.');
	
	var self = this;
	this.db.collection('bans').update({ service: this.id, user: user, expired: false }, { service: this.id, user: user, expiry: expiry, expired: false }, { upsert: true }, function(err) {
		if (err) {
			throw err;
		}
		
		self.query('put', 'chats/' + self.cid + '/ban/' + user, {}, cb);
	});
};

beam.prototype.unbanUser = function(user, cb) {
	log.info('Unbanning user ' + user + ' from ' + this.channel + '...');
	
	var self = this;
	this.db.collection('bans').update({ user: user }, { $set: { expired: true } }, { multi: true }, function(err) {
		if (err) {
			throw err;
		}
		
		self.query('delete', 'chats/' + self.cid + '/ban/' + user, {}, cb);
	});
};

beam.prototype.checkBans = function() {
	var self = this;
	this.db.collection('bans').find({ service: this.id, expiry: { $lte: new Date().getTime() / 1000 }, expired: false }).toArray(function(err, rows) {
		rows.forEach(function(row) {
			self.unbanUser(row.user);
			self.db.collection('bans').update({ _id: row._id }, { $set: { expired: true } }, function(err) {
				if (err) {
					throw err;
				}
			});
		});
	});
};

beam.prototype.isFollowing = function(id, page, cb) {
	log.info('Checking if user is following ' + this.channel + ' (page ' + page + ')...');
	var self = this;
	this.query('get', 'users/' + id + '/follows?limit=5&page=' + page, {}, function(err, res, body) { //TODO higher limit!
		if (err || res.statusCode !== 200) {
			return cb(new Error('connection error'));	
		}
		
		var data = JSON.parse(body);
		if (data.length == 0) {
			log.info('User is not following.');
			return cb(null, false);
		}
		
		for (var i in data) {
			if (data[i].id == self.cid) {
				log.info('User is following');
				return cb(null, true);
			}
		}
		
		self.isFollowing(id, page + 1, cb);
	});
};

beam.prototype.parseMessage = function(parts) {
	var result = '';
	if (parts instanceof Array) {
		parts.forEach(function(part) {
			if (part.type == 'text') {
				result = result + part.data;	
			}else{
				result = result + part.text;
			}
		});
	}else{
		result = parts;
	}
	return ent.decode(result);
};

beam.prototype.handleMessage = function(data) {
	this.emit('data', data);
	var self = this;
	if (data.ex[0].substring(0, 1) == '!') {
		var command = data.ex[0].substring(1).toLowerCase();
	}else if (data.ex[0].toLowerCase() == '@' + this.config.username.toLowerCase()) {
		data.ex.shift();
		var command = data.ex[0].toLowerCase();
	}else{
		return;
	}
	
	if (self.listeners('command:' + command).length > 0 && (!(data.user.id in this.uses) || (new Date().getTime() - this.uses[data.user.id]) > 1000)) {
		this.uses[data.user.id] = new Date().getTime();
		data.ex.shift();
		this.deleteMessage(data.id, function() {
			self.emit('command:' + command, data);
		});
	}
};

beam.prototype.hasRole = function(groups, role) {
	return groups.indexOf(role.toLowerCase()) != -1;
};

beam.prototype.requireRole = function(groups, sender, role) {
	var allowed = this.hasRole(groups, role) || this.bypass.indexOf(sender) != -1;
	if (!allowed && groups.indexOf('blipbot') != -1 && this.config.admins.indexOf(sender) != -1) {
		this.bypass.push(sender);
		this.sendMessage('A BlipBot admin, @' + sender + ', is using admin override. He can run some commands, but has no moderator abilities.');
		allowed = true;
	}
	if (!allowed) {
		this.sendMessage('You do not have permission to use this command', sender);
	}
	return allowed;
};