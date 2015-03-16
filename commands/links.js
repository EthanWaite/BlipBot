var request = require('request');
var cheerio = require('cheerio');

module.exports = {
	id: 'links',
	name: 'Link Resolver',
	description: 'Automatically resolves any links that are pasted in chat.',
	commands: [],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('data', dataHandler);
}

function disable(service) {
	service.removeListener('data', dataHandler);
}

function dataHandler(data) {
	var self = this;
	for (var i in data.raw) {
		var part = data.raw[i];
		if (part.type == 'link') {
			if (/(http(s)?:\/\/beam.pro\/)([A-Za-z0-9]+)(\/)?/ig.test(part.url)) {
				request('https://beam.pro/api/v1/channels/' + part.url.split('/')[3], function(err, res, body) {
					if (err || res.statusCode !== 200) {
						return;	
					}
					
					var channel = JSON.parse(body);
					self.sendMessage('(' + (channel.online ? 'Online' : 'Offline') + ') ' + channel.name, data.user.name);
				});
			}else{
				request(part.url, function(err, res, body) {
					if (err) {
						return;
					}

					var $ = cheerio.load(body);
					var title = $('head meta[property="og:title"]').attr('content');
					if (title) {
						var description = $('head meta[property="og:description"]').attr('content');
						if (description) {
							title = title + ': ' + description;	
						}
					}else{
						title = $('head title').text();
						if (title.length == 0) {
							return;
						}
					}
					self.sendMessage(title.substring(0, 200), data.user.name);
				});
			}
			
			break;
		}
	}
}