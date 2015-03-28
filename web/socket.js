var net = require('net');
var log = require('log4js').getLogger('SOCKET');

module.exports = function(config, services) {
	net.createServer(function(c) {
		log.debug('Received connection from ' + c.remoteAddress + '.');
		sendData(c, { status: true });
		
		var data = '';
		c.on('data', function(part) {
			data = data + part.toString();
			
			if (data.length > 200 || data.indexOf('\n') != -1) {
				data = data.split('\n')[0].trim();
				var ex = data.split(' ');
				log.debug('Received data: ' + data);
				
				if (ex[0] == 'SUBSCRIBE' && ex.length == 2) {
					c.channel = ex[1];
					for (var i in services) {
						var service = services[i];
						if (service.channel.toLowerCase() != ex[1].toLowerCase()) {
							continue;
						}

						service.on('online', function() {
							sendData(c, { event: 'online' });
						});

						service.on('whitelist', function(username) {
							log.info('Whitelisting ' + username + ' on Minecraft...');
							sendData(c, { event: 'whitelist', username: username });
						});
					}
				}else{
					sendData(c, { error: 'invalid command' });
				}
			}
		});
		
		c.on('error', function(err) {
			log.debug('Error communicating with socket.');
		});
		
		c.on('close', function() {
			log.debug('Lost connection.');
		});
	}).listen(config.general.socket);
};

function sendData(c, data) {
	c.write(JSON.stringify(data) + '\r\n');
}