module.exports = function(app) {
	app.get('/login', function(req, res) {
		res.render('login', { title: 'Admin Login' });
	});
	
	app.post('/login', function(req, res) {
		app.get('db').collection('users').find({ username: req.body.username, password: req.body.password }).toArray(function(err, rows) {
			if (err) {
				throw err;
			}
			
			if (rows.length == 0) {
				res.redirect('./login');	
			}else{
				req.session.id = rows[0]._id;
				res.redirect('./');
			}
		});
	});
};