module.exports = function(app) {
	app.get('/overlay/:channel?', function(req, res) {
		res.render('overlay', { channel: req.params.channel, layout: null });
	});
};