var request = require('request');
var cheerio = require('cheerio');
var log = require('log4js').getLogger('GAME');

var games = {
	"aoe3": {
		"type": "steam",
		"id": 105450
	},
	"arma3": {
		"type": "steam",
		"id": 107410
	},
	"bf4": {
		"name": "Battlefield 4",
		"type": "external",
		"url": "http://www.battlefield.com/battlefield-4"
	},
	"borderlands": {
		"type": "steam",
		"id": 49520
	},
	"cities": {
		"type": "steam",
		"id": 255710
	},
	"civ5": {
		"type": "steam",
		"id": 8930
	},
	"cod": {
		"type": "steam",
		"id": 209650
	},
	"cs-go": {
		"type": "steam",
		"id": 730
	},
	"d3ros": {
		"name": "Diablo III",
		"type": "external",
		"url": "http://us.battle.net/d3"
	},
	"dayz": {
		"type": "steam",
		"id": 221100
	},
	"destiny": {
		"name": "Destiny",
		"type": "external",
		"url": "http://www.destinythegame.com"
	},
	"dota2": {
		"type": "steam",
		"id": 570
	},
	"dying-light": {
		"type": "steam",
		"id": 239140
	},
	"gta5": {
		"type": "steam",
		"id": 271590
	},
	"h1z1": {
		"type": "steam",
		"id": 295110
	},
	"hearthstone": {
		"name": "Hearthstone",
		"type": "external",
		"url": "http://us.battle.net/hearthstone"
	},
	"isaac": {
		"type": "steam",
		"id": 250900
	},
	"minecraft": {
		"name": "Minecraft",
		"type": "external",
		"url": "http://minecraft.net"
	},
	"pathofexile": {
		"type": "steam",
		"id": 238960
	},
	"sc2-hots": {
		"name": "Minecraft",
		"type": "external",
		"url": "http://us.battle.net/sc2",
	},
	"simcity": {
		"name": "Sim City",
		"type": "external",
		"id": "http://www.simcity.com"
	},
	"skyrim": {
		"type": "steam",
		"id": 72850
	},
	"smite": {
		"name": "Smite",
		"type": "external",
		"url": "http://www.hirezstudios.com/smite"
	},
	"starbound": {
		"type": "steam",
		"id": 211820
	},
	"superhexagon": {
		"type": "steam",
		"id": 221640
	},
	"swtor": {
		"type": "steam",
		"id": 208580
	},
	"tera": {
		"type": "steam",
		"id": 323370
	},
	"tf2": {
		"type": "steam",
		"id": 440
	},
	"titanfall": {
		"name": "Titanfall",
		"type": "external",
		"url": "http://www.titanfall.com"
	},
	"world-of-tanks": {
		"name": "World of Tanks",
		"type": "external",
		"url": "http://worldoftanks.com"
	},
	"wow": {
		"name": "World of Warcraft",
		"type": "external",
		"url": "http://us.battle.net/wow"
	}
};

module.exports = {
	id: 'game',
	name: 'Game',
	description: 'This module displays information about the current game, as set on Beam. The game\'s price and link will be provided, where possible. Alternatively, you can pass a search term to the command, and the bot will search Steam.',
	commands: [ 'game [search]' ],
	enable: enable,
	disable: disable
};

function enable(service) {
	service.on('command:game', game);
}

function disable(service) {
	service.removeListener('command:game', game);
}

function game(data) {
	var self = this;
	if (data.ex.length > 0) {
		request('http://store.steampowered.com/search/?cc=us&term=' + data.ex.join(' '), function(err, res, body) {
			if (err || res.statusCode != 200) {
				return self.sendMessage('I tried searching on Steam, but received an unexpected error.', data.user.name);
			}
			
			var i = cheerio.load(body)('a.search_result_row').first();
			
			if (i.find('.col.search_price').length == 0) {
				return self.sendMessage('I tried searching on Steam, but I couldn\'t find the game you were looking for.', data.user.name);
			}
			
			console.log(i);
			
			var price = i.find('.col.search_price').text().trim();			
			var pex = i.find('.col.search_price').html().split('<br>');
			if (pex.length == 2) {
				var discount = i.find('.col.search_discount span').text();
				var dex = discount.split('-');
				if (dex.length == 2) {
					discount = dex[1];
				}
				
				price = pex[1].trim() + ' (' + discount + ' off, normally ' + pex[1].trim() + ')';
			}
			
			self.sendMessage('I searched on Steam, and found ' + i.find('.title').text() + ' for ' + price + ' at ' + i.attr('href').split('?')[0], data.user.name);
		});
		return;
	}
	
	if (!this.game) {
		return this.sendMessage('The streamer has not marked themselves as playing a game on Beam.', data.user.name);	
	}
	
	if (!(this.game in games)) {
		return this.sendMessage('I\'m not sure. Sorry. :(', data.user.name);
	}
	
	var game = games[this.game];
	
	if (game.type == 'steam') {
		request('http://store.steampowered.com/api/appdetails?appids=' + game.id + '&cc=US&l=English', function(err, res, body) {
			if (err) {
				log.warn(err);
			}
			
			if (err || res.statusCode != 200) {
				return self.sendMessage('http://store.steampowered.com/app/' + game.id, data.user.name);
			}
			
			try {
				var result = JSON.parse(body);
			} catch(e) {
				log.warn(e);
				return self.sendMessage('Hm, I got a weird response from the Steam Store. Please try again in a little bit. :(', data.user.name);
			}
			
			if (!(game.id in result)) {
				log.warn('Unable to find ' + game.id + ' in Steam result.');
				return self.sendMessage('I can\'t seem to find this game right now. Please try again in a little bit. :(', data.user.name);	
			}
			result = result[game.id].data;
			
			self.sendMessage(result.name + (result.release_date.coming_soon ? ' (COMING SOON)' : '') + ': ' + (result.is_free ? 'Free to Play ' : ('$' + (result.price_overview.final / 100) + ' ' + (result.price_overview.discount_percent > 0 ? '(' + result.price_overview.discount_percent + '% off, normally $' + (result.price_overview.initial / 100) + ') ' : ''))) + 'at https://store.steampowered.com/app/' + game.id, data.user.name);
		});
	}else if (game.type == 'external') {
		this.sendMessage(game.name + ' - ' + game.url, data.user.name);
	}
}