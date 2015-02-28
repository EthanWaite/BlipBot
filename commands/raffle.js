var log = require('log4js').getLogger('RAFFLE');
var users = [];
var term = null;

module.exports = {
	id: 'raffle',
	name: 'Raffle',
	description: 'This allows moderators to start a raffle, where people who say a certain word will be entered into a random competition.',
	commands: [ 'raffleset <word>', 'raffleend' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.raffleUsers = [];
	service.raffleTerm = '';
	service.on('data', dataHandler);
	service.on('command:raffleset', raffleSet);
	service.on('command:raffleend', raffleEnd);
}

function disable(service) {
	service.removeListener('data', dataHandler);
	service.removeListener('command:raffleset', raffleSet);
	service.removeListener('command:raffleend', raffleEnd);
}

function dataHandler(data) {
	if (this.raffleTerm && users.indexOf(data.user.name) == -1 && data.msg.indexOf(this.raffleTerm) != -1) {
		log.info('Entering ' + data.user.name + ' into the draw.');
		this.raffleUsers.push(data.user.name);
	}
}

function raffleSet(data) {
	if (this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		this.raffleUsers = [];
		this.raffleTerm = data.ex[0] || '';
		this.sendMessage('Any users who say ' + (this.raffleTerm == '' ? 'anything' : this.raffleTerm) + ' will be entered into the raffle.', data.user.name);
	}
}

function raffleEnd(data) {
	if (this.requireRole([ 'mod', 'owner' ], data.user.name, data.user.role)) {
		if (this.raffleUsers.length == 0) {
			return this.sendMessage('Nobody entered the raffle this time. Awh. :(', data.user.name);	
		}

		this.sendMessage('@' + this.raffleUsers[Math.floor(Math.random() * users.length)] + ' has been randomly drawn.');
		this.raffleUsers = [];
		this.raffleTerm = null;
	}
}