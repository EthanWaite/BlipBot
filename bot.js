var fs = require('fs');
var mongo = require('mongodb').MongoClient;
var log = require('log4js').getLogger('MAIN');
var config = JSON.parse(fs.readFileSync('config.json'));

log.info('Starting BlipBot Chat Bot.');

connectMongo(function(db) {
	require('./web/server')(db);
	db.collection('users').find({}).toArray(function(err, rows) {
		rows.forEach(function(row) {
          registerUser(db, row);
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

function registerUser(db, user) {
	for (var key in user.services) {
		registerService(db, key, user.services[key]);
	}
}

function registerService(db, name, channel) {
	var service = require('./services/' + name);
	service = new service(db, config.services[name], channel);
	
	fs.readdir('./commands', function(err, files) {
		files.forEach(function(file) {
			require('./commands/' + file)(service);
		});
	});
}