var fs = require('fs');
var mongo = require('mongodb').MongoClient;
var log = require('log4js').getLogger('MAIN');
var config = JSON.parse(fs.readFileSync('config.json'));
var services = {};
var modules = {};

fs.readdirSync('commands').forEach(function(file) {
	var command = require('./commands/' + file);
	modules[command.id] = command;
});

log.info('Starting BlipBot Chat Bot.');

var web = require('./web/server');
connectMongo(function(db) {
	web = new web(config, db, services, modules);
	db.collection('services').find({}).toArray(function(err, rows) {
		rows.forEach(function(row) {
			registerService(db, row);
        });
	});
});

function connectMongo(cb) {
	log.info('Connecting to MongoDB...');
	mongo.connect('mongodb://' + config.db.host + ':' + config.db.port + '/' + config.db.name, function(err, db) {
		if (err) {
			throw err;
		}
		
		db.authenticate(config.db.username, config.db.password, function(err, result) {
			if (err || !result) {
				return log.warn('Unable to authenticate with MongoDB.');
			}
			
			cb(db);
		});
	});
}

function registerService(db, data) {
	var service = require('./services/' + data.type);
	service = new service(db, config.services[data.type], data._id, data.channel);
	service.on('data', function(data) {
		web.emit('chat', data);
	});
	services[data._id] = service;
	
	db.collection('modules').find({ service: data._id }).toArray(function(err, rows) {
		rows.forEach(function(row) {
			if (row.enabled && row.module in modules) {
				modules[row.module].enable(service, row.config || {});
			}
		});
	});
}