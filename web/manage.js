var async = require('async');

module.exports = function(app) {
	app.get('/', function(req, res) {
		res.redirect('/beam');
	});
	
	app.get('/:type', function(req, res) {
		var modules = app.get('modules');
		async.each(Object.keys(app.get('modules')), function(m, cb) {
			app.get('db').collection('modules').find({ service: req.service._id, module: modules[m].id }).toArray(function(err, rows) {
				modules[m].enabled = !err && rows.length == 1 && rows[0].enabled;
				cb();
			});
		}, function() {
			res.render('manage', { title: 'Manage Channel', service: req.service, modules: modules });
		});
	});
};