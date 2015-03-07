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
			request(part.url, function(err, res, body) {
				if (err) {
					return;
				}
				
				var title = cheerio.load(body)('head title').text();
				if (title.length == 0) {
					return;
				}
				
				self.sendMessage(title, data.user.name);
			});
			
			break;
		}
	}
}