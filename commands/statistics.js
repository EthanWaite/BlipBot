var mongodb = require('mongodb');
var async = require('async');
var log = require('log4js').getLogger('STATISTICS');

module.exports = {
	id: 'statistics',
	name: 'Statistics',
	description: 'Statistics about your channel\'s activity and users\' activity are gathered. You can then see statistics for either the whole channel, or the statistics for a specific user.',
	commands: [ 'statistics [user]' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('command:statistics', statistics);
	service.on('command:stats', statistics);
}

function disable(service) {
	service.removeListener('command:statistics', statistics);
	service.removeListener('command:stats', statistics);
}

function statistics(data) {
	var id = mongodb.ObjectID(this.id);
	
	var self = this;
	if (data.ex.length == 0) {
		var current = this.statistics;
		
		this.db.collection('statistics').aggregate([
			{
				$match: {
					service: id
				}
			},
			{
				$group: {
					_id: null,
					messages: {
						$sum: "$messages"
					},
					words: {
						$sum: "$words"
					},
					characters: {
						$sum: "$characters"
					}
				}
			}
		], function(err, result) {
			if (err) {
				return log.warn(err);
			}
			
			if (result.length < 1) {
				return self.sendMessage('I have not been here long enough to gather any statistics.', data.user.name);
			}

			self.sendMessage('There have been ' + (result[0].messages + current.messages) + ' messages, with ' + (result[0].words + current.words) + ' words and ' + (result[0].characters + current.characters) + ' characters, in this channel.', data.user.name);
		});
	}else{
		var user = data.ex[0];
		if (user.indexOf('@') == 0) {
			user = user.substring(1);	
		}
		
		async.series([
			function(cb) {
				self.db.collection('viewers').find({ service: id, name: user }).toArray(cb);
			},
			
			function(cb) {
				self.db.collection('viewers').aggregate([
					{
						$match: {
							name: user
						}
					},
					{
						$group: {
							_id: null,
							messages: {
								$sum: "$messages"
							}
						}
					}
				], cb);
			}
		], function(err, result) {
			if (err) {
				return log.warn(err);
			}
			
			if (result[0].length < 1) {
				return self.sendMessage('I haven\'t seen this user speak.', data.user.name);	
			}
			
			self.isFollowing(result[0][0].user, 0, function(err, res) {
				self.sendMessage('The user @' + user + ' has sent ' + result[0][0].messages + ' messages to this channel, with ' + result[0][0].words + ' words and ' + result[0][0].characters + ' characters. Overall, I have seen them send ' + result[1][0].messages + ' messages on Beam. ' + (err ? '' : 'They are ' + (res ? '' : 'not ') + 'following the channel.'), data.user.name);
			});
		});
	}
}