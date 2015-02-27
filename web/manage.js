module.exports = function(app) {
	app.get('/:type', function(req, res) {
		app.get('db').collection('modules').find({ service: req.service._id }).toArray(function(err, modules) {
			res.render('manage', { title: 'Manage Channel', service: req.service, modules: modules });
		});
	});
};