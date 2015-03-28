var mongodb = require('mongodb');
var async = require('async');

module.exports = function(app) {
	app.get('/', function(req, res) {
		res.redirect('/beam');
	});
	
	app.get('/:type', function(req, res) {
		var order = [ 'custom', 'clear', 'filter', 'follow', 'links', 'raffle', 'schedule', 'aliases', 'seen', 'game', 'ping' ];
		var modules = app.get('modules');
		async.each(Object.keys(app.get('modules')), function(m, cb) {
			app.get('db').collection('modules').find({ service: req.service._id, module: modules[m].id }).toArray(function(err, rows) {
				modules[m].enabled = !err && rows.length == 1 && rows[0].enabled;
				cb();
			});
		}, function() {
			app.get('db').collection('warnings').find({ service: req.service._id }).toArray(function(err, rows) {
				var users = {};
				rows.forEach(function(row) {
					if (!(row.user in users)) {
						users[row.user] = [];
					}
					row.date = new mongodb.ObjectID(row._id).getTimestamp();
					users[row.user].push(row);
				});
				
				var modulelist = [];
				order.forEach(function(m) {
					modulelist.push(modules[m]);
				});
				
				res.render('manage', { title: 'Manage Channel', service: req.service, modules: modulelist, warnings: users });
			});
		});
	});
};