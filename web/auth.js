var mongodb = require('mongodb');
var async = require('async');
var bcrypt = require('bcrypt');

module.exports = function(app, services) {
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
				req.session.username = rows[0].username;
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
	
	app.post('/delete', function(req, res) {
		console.log('Deleting!');
		async.series([
			function(callback) {
				app.get('db').collection('services').find({ user: new mongodb.ObjectID(req.session.userid) }).toArray(function(err, rows) {
					if (err) {
						return callback(err);
					}
					
					rows.forEach(function(row) {
						if (row._id in services) {
							services[row._id].disconnect();
						}
					});
					
					callback();
				});
			},
			function(callback) {
				app.get('db').collection('services').remove({ user: new mongodb.ObjectID(req.session.userid) }, callback);
			},
			function(callback) {
				app.get('db').collection('users').remove({ _id: new mongodb.ObjectID(req.session.userid) }, callback);
			},
			function(callback) {
				app.get('db').collection('deletes').insert({ name: req.session.username, reason: req.body.reason }, callback);
			}
		], function(err) {
			if (err) {
				return log.warn(err);
			}
			res.redirect('http://blipbot.dead-i.co.uk/');
		});
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