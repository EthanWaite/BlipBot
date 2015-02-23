var express = require('express');
var session = require('express-session');
var bodyparser = require('body-parser');
var io = require('socket.io');
var hbs = require('hbs');
var http = require('http');

module.exports = function(db) {
	var app = express();
	app.set('db', db);
	app.set('view engine', 'html');
	app.engine('html', require('hbs').__express);
	
	app.use(express.static('public'));
	app.use(bodyparser.urlencoded({ extended: false }));
	
	var ses = session({
		secret: 'cake',
		saveUninitialized: true,
		resave: false
	});
	app.use(ses);
	
	require('./auth')(app);
	
	http.Server(app).listen(8080);
};