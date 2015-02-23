var fs = require('fs');
var mongo = require('mongodb').MongoClient;
var log = require('log4js').getLogger('MAIN');

var config = JSON.parse(fs.readFileSync('config.json'));

log.info('Starting BlipBot Chat Bot.');

function connectMongo(cb) {
	log.info('Connecting to MongoDB...');
	mongo.connect('mongodb://' + config.db.host + ':' + config.db.port + '/' + config.db.name, function(err, db) {
		if (err) {
			throw err;
		}

		if(config.db.username != null || config.db.password != null){
			db.authenticate(config.db.username, config.db.password, function(err, result) {
				if (err || !result) {
					return log.warn('Unable to authenticate with MongoDB.');
				}

				cb(db);
			});
		}
		log.info('Connected to MongoDB.')
		cb(db);
	});
}

connectMongo(function(db) {
	var service = require('./services/beam');
	service = new service(db, config);

	fs.readdir('./commands', function(err, files) {
		files.forEach(function(file) {
			require('./commands/' + file)(service);
		});
	});
});
