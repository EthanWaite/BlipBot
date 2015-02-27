var express = require('express');
var session = require('express-session');
var bodyparser = require('body-parser');
var socketio = require('socket.io');
var hbs = require('hbs');
var http = require('http');
var events = require('events').EventEmitter;
var util = require('util');

module.exports = web = function(config, db) {
	events.call(this);
	
	var app = express();
	app.set('db', db);
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
	
	var server = http.Server(app).listen(8080);
	var io = socketio(server);
	io.use(function(c, next) {
		ses(c.request, c.request.res, next);
	});
	io.on('connection', function(c) {
		if (!('userid' in c.request.session)) {
			return c.disconnect(); // Noooope.
		}
		
		c.on('service', function(data, cb) {
			if ('type' in data) {
				app.get('db').collection('services').find({ user: c.request.session.userid, type: data.type }).toArray(function(err, rows) {
					if (!err && rows.length > 0) {
						c.service = rows[0];
						cb();
					}
				});
			}
		});
	});
	
	this.on('chat', function(data) {
		console.log('Chat!');
		io.sockets.sockets.forEach(function(c) {
			if ('service' in c && c.service.type == data.type) {
				c.emit('chat', data);
			}
		});
	});
	
	require('./auth')(app);
	require('./manage')(app);
};

util.inherits(web, events);