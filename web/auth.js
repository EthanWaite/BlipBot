var mongodb = require('mongodb');
var bcrypt = require('bcrypt');

module.exports = function(app) {
	app.get('/login', function(req, res) {
		res.render('login', { title: 'Admin Login' });
	});
	
	app.get('/logout', function(req, res) {
		req.session.destroy();
		res.redirect('/');
	});
	
	app.post('/login', function(req, res) {
		app.get('db').collection('users').find({ username: req.body.username }).toArray(function(err, rows) {
			if (err) {
				throw err;
			}
			
			if (rows.length == 0) {
				return res.render('login', { title: 'Admin Login', error: 'Invalid login credentials.' });
			}
			
			bcrypt.compare(req.body.password, rows[0].password, function(err, match) {
				if (err || !match) {
					return res.render('login', { title: 'Admin Login', error: 'Invalid login credentials.' });
				}
				req.session.userid = rows[0]._id;
				req.session.services = rows[0].services;
				res.redirect('./');
			});
		});
	});
	
	app.all('*', function(req, res, next) {
		if (!('userid' in req.session)) {
			return res.redirect('/login');
		}
		next();
	});
	
	app.all('/:service', function(req, res, next) {
		app.get('db').collection('services').find({ user: new mongodb.ObjectID(req.session.userid), type: req.params.service }).toArray(function(err, rows) {
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