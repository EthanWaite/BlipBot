var fs = require('fs');
var log = require('log4js').getLogger('SERVICES');

var modules = {};
var credentials = {};

fs.readdirSync('commands').forEach(function(file) {
	var command = require('../commands/' + file);
	modules[command.id] = command;
});

exports.registerService = function(config, db, web, data, cb) {
	var service = require('./' + data.type);
	
	if (!(data.type in credentials)) {
		credentials[data.type] = {};
	}
	
	var cfg = config.services[data.type];
	credentials[data.type][cfg.username] = cfg;
	service = new service(config.services[data.type], db, data._id, data.channel);
	
	checkAuthentication(service, cfg, function(data) {
		service.connect(data);
		service.on('data', function(chat) {
			web.emit('chat', chat, data._id);
		});

		db.collection('modules').find({ service: data._id }).toArray(function(err, rows) {
			rows.forEach(function(row) {
				if (row.enabled && row.module in modules) {
					modules[row.module].enable(service, row.config || {});
				}
			});
		});
		
		cb(service);
	});
}

function checkAuthentication(service, cfg, cb) {
	if (cfg.user in credentials) {
		return cb(credentials[cfg.user]);
	}
	
	service.getAuth(cfg, function(err, data) {
		if (err) {
			return log.warn(err);
		}
		
		cb(data);
	});
}

exports.modules = modules;