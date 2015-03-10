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
	
	var ses = session({
		secret: config.general.secret,
		saveUninitialized: true,
		resave: false
	});
	app.use(ses);
	
	var server = http.Server(app).listen(config.general.port);
	var io = socketio(server);
	io.use(function(c, next) {
		ses(c.request, c.request.res, next);
	});
	io.on('connection', function(c) {
		if (!('userid' in c.request.session)) {
			c.on('signup', function(data, cb) {
				if (!('username' in data && 'password' in data && 'email' in data && 'beam' in data)) {
					return cb('Invalid parameters.');
				}
				
				if (validator.isNull(data.username) || validator.isNull(data.password) || validator.isNull(data.beam) || !validator.isEmail(data.email)) {
					return cb('Please ensure you have entered valid information.');	
				}
				
				async.waterfall([
					function(callback) {
						app.get('db').collection('services').find({ type: 'beam', channel: data.beam }).toArray(function(err, rows) {
							if (err) {
								return callback(err);
							}
							if (rows.length > 0) {
								return cb('This channel is already registered.');
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
								return cb('You already own an account. Please log in.');
							}
							callback();
						});
					},
					
					function(callback) {
						var service = require('../services/beam');
						service = new service(app.get('db'), config.services['beam'], null, data.beam, function(err) {
							return cb('The channel you have specified does not exist.');	
						});

						var timeout = setTimeout(function() {
							cb('Your request has expired. Please try again.');
							service.disconnect();
						}, 10000);

						service.on('connected', function() {
							service.sendMessage('I am a Beam chat bot, and I have been asked to join here from the web interface. Please type /mod BlipBot if you authorized this request.');
						});

						service.on('authenticated', function() {
							service.sendMessage('BlipBot is now online. You can now manage me from the web interface.');
							clearTimeout(timeout);
							callback();
						});
					},
					
					function(callback) {
						bcrypt.hash(data.password, 8, function(err, hash) {
							if (err) {
								return callback(err);
							}
							app.get('db').collection('users').insert({ username: data.username, password: hash, email: data.email }, function(err, record) {
								if (err) {
									return callback(err);
								}
								callback(null, record[0]._id);
							});
						});
					},
					
					function(id, callback) {
						app.get('db').collection('services').insert({ user: id, type: 'beam', channel: data.beam }, callback);
					}
				], function(err) {
					if (err) {
						log.warn(err);
						return cb('Internal error.');
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
					}
				});
			}
		});
		
		c.on('modulestate', function(data, cb) {
			if ('id' in data && 'state' in data && data.id in modules) {
				console.log(c.service);
				var id = c.service._id;
				var m = modules[data.id];
				var params = { service: id, module: m.id };
				app.get('db').collection('modules').update(params, { service: id, module: m.id, enabled: data.state === true }, { upsert: true }, function(err) {
					if (err) {
						return log.warn(err);
					}
					
					app.get('db').collection('modules').find(params).toArray(function(err, rows) {
						if (err) {
							throw err;
						}
						
						if (id in services) {
							var service = services[id];
							if (data.state) {
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
							cb(config, rows[0].config || {});
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
				app.get('db').collection('modules').update({ service: c.service._id, module: m.id }, { service: c.service._id, module: m.id, config: data.config }, function(err) {
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
	
	app.get('/status', function(req, res) {
		res.json({ status: true });
	});
	
	require('./auth')(app);
	require('./manage')(app);
};

util.inherits(web, events);