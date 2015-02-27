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
				req.session.userid = rows[0]._id;
				req.session.services = rows[0].services;
				res.redirect('./');
			}
		});
	});
	
	app.all('*', function(req, res, next) {
		if (!('userid' in req.session)) {
			return res.redirect('/login');
		}
		next();
	});
	
	app.all('/:service', function(req, res, next) {
		app.get('db').collection('services').find({ user: req.session.userid, type: req.params.service }).toArray(function(err, rows) {
			if (err) {
				throw err;
			}
			
			if (rows.length == 0) {
				return res.redirect('/');
			}
			
			req.service = rows[0];
			next();
		});
	});
};