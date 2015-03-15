var fs = require('fs');
var modules = {};

fs.readdirSync('commands').forEach(function(file) {
	var command = require('../commands/' + file);
	modules[command.id] = command;
});

exports.registerService = function(config, db, web, data) {
	var service = require('./' + data.type);
	service = new service(config.services[data.type], db, data._id, data.channel);
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
	
	return service;
}

exports.modules = modules;