var express = require('express');
var session = require('express-session');
var bodyparser = require('body-parser');
var socketio = require('socket.io');
var hbs = require('hbs');
var http = require('http');
var mongodb = require('mongodb');
var async = require('async');
var bcrypt = require('bcrypt');
var validator = require('validator');
var events = require('events').EventEmitter;
var util = require('util');
var log = require('log4js').getLogger('WEB');

module.exports = web = function(config, db, services, modules) {
	events.call(this);
	
	var app = express();
	app.set('db', db);
	app.set('modules', modules);
	app.set('view engine', 'html');
	app.engine('html', hbs.__express);
	
	app.use(express.static('public'));
	app.use(bodyparser.urlencoded({ extended: false }));
	
	app.use(function(req, res, next) {
		res.header('Access-Control-Allow-Origin', 'http://blipbot.dead-i.co.uk/');
		next();
	});
	
	var ses = session({
		secret: config.general.secret,
		saveUninitialized: true,
		resave: false
	});
	app.use(ses);
	
	var server = http.Server(app).listen(config.general.port);
	io = socketio(server);
	io.use(function(c, next) {
		ses(c.request, c.request.res, next);
	});
	
	var pending = [];
	io.on('connection', function(c) {
		c.on('watch', function(data, cb) {
			if (!('channel' in data)) {
				return;
			}
			
			for (var i in services) {
				var channel = services[i].channel;
				if (channel.toLowerCase() == data.channel.toLowerCase()) {
					c.watch = channel;
					return cb();
				}
			}
			
			return cb('BlipBot is not in this channel.');
		});
		
		if (!('userid' in c.request.session)) {
			c.on('signup', function(data, cb) {
				if (!('username' in data && 'password' in data && 'email' in data && 'beam' in data)) {
					return cb('Invalid parameters.');
				}
				
				if (validator.isNull(data.username) || validator.isNull(data.password) || validator.isNull(data.beam) || !validator.isEmail(data.email)) {
					return cb('Please ensure you have entered valid information.');	
				}
				
				if (!/^([A-Za-z0-9_\-\.]+)$/.test(data.username) || !/^([A-Za-z0-9_\-\.]+)$/.test(data.beam)) {
					return cb('Your username can only contain numbers, letters, periods, dashes and underscores.');
				}
				
				if (pending.indexOf(data.beam.toLowerCase()) != -1) {
					return cb('Sorry, but there is already a pending signup request using this channel. Please try again shortly.');
				}
				pending.push(data.beam.toLowerCase());
				
				async.waterfall([
					function(callback) {
						app.get('db').collection('services').find({ type: 'beam', channel: { $regex: '^' + data.beam + '$', $options: 'i' } }).toArray(function(err, rows) {
							if (err) {
								return callback(err);
							}
							if (rows.length > 0) {
								return callback('This channel is already registered.');
							}
							callback();
						});
					},
					
					function(callback) {
						app.get('db').collection('users').find({ $or: [ { username: data.username, email: data.email} ] }).toArray(function(err, rows) {
							if (err) {
								return callback(err);
							}
							if (rows.length > 0) {
								return callback('You already own an account. Please log in.');
							}
							callback();
						});
					},
					
					function(callback) {
						log.info('Joining channel ' + data.beam + ' for verification...');
						
						var service = require('../services/beam');
						service = new service(config.services['beam'], app.get('db'), null, data.beam);
						service.getAuth(config.services['beam'], function(err, data) {
							service.connect(data, function(err) {
								return callback('The channel you have specified does not exist.');
							});
						});

						var timeout = setTimeout(function() {
							callback('Your request has expired. Please try again.');
							service.disconnect();
						}, 60000);

						service.once('connected', function() {
							service.sendMessage('I am a Beam chat bot, and I have been asked to join here from the web interface. Please type /mod BlipBot if you authorized this request.');
						});

						service.once('authenticated', function() {
							log.info('Successfully verified ' + data.beam + '.');
							clearTimeout(timeout);
							callback(null, service);
						});
					},
					
					function(service, callback) {
						bcrypt.hash(data.password, 8, function(err, hash) {
							if (err) {
								return callback(err);
							}
							app.get('db').collection('users').insert({ username: data.username, password: hash, email: data.email }, function(err, record) {
								if (err) {
									return callback(err);
								}
								callback(null, service, record[0]._id);
							});
						});
					},
					
					function(service, user, callback) {
						app.get('db').collection('services').insert({ user: user, type: 'beam', channel: data.beam }, function(err, records) {
							if (err) {
								return callback(err);
							}
							service.sendMessage('BlipBot is now online. You can now manage me from the web interface.');
							service.id = records[0]._id;
							services[service.id] = service;
							callback(null, service);
						});
					},
					
					function(service, callback) {
						async.each(Object.keys(modules), function(i, callback) {
							app.get('db').collection('modules').insert({ service: service.id, module: modules[i].id, enabled: true }, function(err) {
								if (err) {
									return log.warn(err);
								}
								
								log.debug('Enabling module ' + i + ' for new signup.');
								modules[i].enable(service, {});
								callback();
							});
						}, callback);
					}
				], function(err) {
					pending.splice(pending.indexOf(data.beam.toLowerCase()), 1);
					if (err) {
						log.warn(err);
						log.warn('Channel: ' + data.beam);
						return cb(typeof err === 'string' ? err : 'Internal error.');
					}
					cb();
				});
			});
			return;
		}
		
		c.on('service', function(data, cb) {
			if ('type' in data) {
				app.get('db').collection('services').find({ user: new mongodb.ObjectID(c.request.session.userid), type: data.type }).toArray(function(err, rows) {
					if (!err && rows.length > 0) {
						c.service = rows[0];
						cb();
						
						if (c.service._id in services) {
							services[c.service._id].messages.slice(0, 20).reverse().forEach(function(msg) {
								c.emit('chat', msg);
							});
						}
					}
				});
			}
		});
		
		c.on('modulestate', function(data, cb) {
			if ('id' in data && 'state' in data && data.id in modules) {
				var id = c.service._id;
				var m = modules[data.id];
				var params = { service: id, module: m.id };
				log.info('Toggling module ' + m.id + '...');
				app.get('db').collection('modules').update(params, { $set: { service: id, module: m.id, enabled: data.state === true } }, { upsert: true }, function(err) {
					if (err) {
						return log.warn(err);
					}
					
					log.debug('Module updated.');
					app.get('db').collection('modules').find(params).toArray(function(err, rows) {
						if (err) {
							throw err;
						}
						
						log.debug('Changing state...');
						if (id in services) {
							var service = services[id];
							if (data.state) {
								log.debug('Enabling module.');
								m.enable(service, rows[0].config || {});
							}else{
								m.disable(service, rows[0].config || {});
							}
						}
						
						cb();
					});
				});
			}
		});
		
		c.on('getconfig', function(data, cb) {
			if ('id' in data && data.id in modules && c.service._id in services) {
				var m = modules[data.id];
				if ('config' in m) {
					app.get('db').collection('modules').find({ service: c.service._id, module: modules[data.id].id }).toArray(function(err, rows) {
						if (err) {
							return log.warn(err);
						}
						
						m.config(services[c.service._id], function(config) {
							cb(config, rows.length == 0 ? {} : rows[0].config);
						});
					});
				}else{
					cb();
				}
			}
		});
		
		c.on('setconfig', function(data, cb) {
			if ('id' in data && 'config' in data && data.id in modules && c.service._id in services) {
				var m = modules[data.id];
				app.get('db').collection('modules').update({ service: c.service._id, module: m.id }, { $set: { config: data.config } }, function(err) {
					if (err) {
						return log.warn(err);
					}
					
					var service = services[c.service._id];
					m.disable(service);
					m.enable(service, data.config);
					cb();
				});
			}
		});
		
		c.on('addconfig', function(data, cb) {
			if ('id' in data && data.id in modules && c.service._id in services && 'add' in modules[data.id]) {
				modules[data.id].add(services[c.service._id], db, data, cb);
			}
		});
		
		c.on('removeconfig', function(data, cb) {
			if ('id' in data && data.id in modules && c.service._id in services && 'remove' in modules[data.id]) {
				modules[data.id].remove(services[c.service._id], db, data, cb);
			}
		});
	});
	
	this.on('chat', function(data, id) {
		var sockets = io.sockets.connected;
		for (var i in sockets) {
			var c = sockets[i];
			if ('service' in c && c.service._id.toString() == id.toString()) {
				c.emit('chat', data);
			}
		}
	});
	
	this.on('follow', function(data, service) {
		var sockets = io.sockets.connected;
		for (var i in sockets) {
			var c = sockets[i];
			if ('watch' in c && c.watch.toLowerCase() == service.channel.toLowerCase()) {
				service.getAvatar(data.id, function(url) {
					c.emit('follow', { username: data.username, avatar: url });
				});
			}
		}
	});
	
	require('./overlay')(app);
	require('./auth')(app, services);
	require('./manage')(app);
};

util.inherits(web, events);