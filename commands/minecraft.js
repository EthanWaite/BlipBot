var log = require('log4js').getLogger('MINECRAFT');

module.exports = {
	id: 'minecraft',
	name: 'Bukkit Integration',
	description: 'This allows your followers to use !whitelist, to grant them access to your Minecraft Server running CraftBukkit or Spigot. In order to use this plugin, you will need to install the <a href="/resources/BlipBot-Bukkit.jar">BlipBot Bukkit plugin</a> on your server, with the whitelist enabled.',
	commands: [ 'whitelist <username>' ],
	enable: enable,
	disable: disable,
};

function enable(service) {
	service.on('command:whitelist', whitelist);
}

function disable(service) {
	service.removeListener('command:whitelist', whitelist);
}

function whitelist(data) {
	if (this.listeners('whitelist').length < 1) {
		return this.sendMessage('Sorry, but no Minecraft servers are available.', data.user.name);
	}
	
	if (data.ex.length < 1) {
		return this.sendMessage('This will whitelist you on our Minecraft server. Please run this command with your in-game username.', data.user.name);
	}
	
	var self = this;
	this.isFollowing(data.user.id, 0, function(err, following) {
		if (err) {
			log.warn('Unable to check whether ' + data.user.name + ' is following.');
			log.warn(err);
			return self.sendMessage('Sorry, but we were unable to connect to Beam. Please try again in a few minutes.', data.user.name);
		}
		
		if (following) {
			self.emit('whitelist', data.ex[0]);
			self.sendMessage('You are now being whitelisted on the server.', data.user.name);
		}else{
			self.sendMessage('Please follow us on Beam, and run the command again. We appreciate the support.', data.user.name);
		}
	});
}