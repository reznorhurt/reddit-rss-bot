var fs = require('fs');
var request = require('request');
var feedparser = require('feedparser');
var colors = require('colors');

// Add your feeds here, separated by commas

var feedList = [
	'http://www.example.com/feed.rss'
];

var bot = {
	ui : {
		login: '',
		cookie: '',
		uh: ''
	},
	brk: '**********'.green,
	lastCheck: '',
	// The two log files for keeping track of posts and the last run time
	lastCheckLog: 'C:\\last_check.txt',
	log: 'C:\\logger.txt',
	posts: [],
	feedTimer: {},
	postTimer: {},
	login: function (user, passwd) {
		var ident = {
			uri: "https://ssl.reddit.com/api/login/" + user,
			form: {
				user: user,
				passwd: passwd,
				api_type: "json"
			},
			headers: {
				'User-Agent': 'RSS bot for /r/Somewhere',
				'Content-Type': "application/x-www-form-urlencoded",
				'Host': 'www.reddit.com'
			}
		};
		request.post(ident, function (err, res, body) {
			if (err) {
				console.error(err);
				return false;
			}
			var data = JSON.parse(body);
			bot.ui.login = user;
			bot.ui.cookie = "reddit_session=" + data.json.data.cookie;
			bot.ui.uh = data.json.data.modhash;
			if (data.json.errors && !data.json.errors.length) {
				console.log('Successfully logged in as: '.yellow + bot.ui.login.rainbow);
			} else {
				console.log("Login failed".red);
				return;
			}
			bot.readIn();
		});
	},
	submit: function (title, article, sub) {
		var postInfo = {
			cookie: bot.ui.cookie,
			uri: "http://www.reddit.com/api/submit",
			form: {
				url: article,
				sr: sub,
				r: sub,
				id: '#newlink',
				title: title,
				kind: 'link',
				uh: bot.ui.uh
			},
			headers: {
				'Content-Type': "application/x-www-form-urlencoded",
				'Host': 'www.reddit.com'
			}
		};
		console.log('\n' + bot.brk);
		console.log("ARTICLE: ".bold.underline + article);
		console.log("TITLE: ".bold.underline + title);
		console.log(bot.brk + '\n');
		request.post(postInfo, function (err, res, body) {
			if (err) {
				console.error(err);
				return;
			}
			var data = JSON.parse(body);
			if (data.jquery[12] && /\/comments\//.test(data.jquery[16][3].toString())) {
				console.log("Successfully submitted: " + data.jquery[12][3][1]);
			} else if (data.jquery[22]) {
				console.log("Submission failed due to rate limiting".red);
				bot.logger(null, 'Failed - Rate limiting: ' + title + ' : ' + article);
			} else {
				console.log("Submission failed due to it being a duplicate or login/cookie issues".red);
				bot.logger(null, 'Failed - Duplication/Cookie issues: ' + title + ' : ' + article);
			}
		});
	},
	readIn: function () {
		var entry = '\n*** Begin log: ' + Date() + '\n';
		fs.exists(bot.lastCheckLog, function (exists) {
			if (exists) {
				fs.readFile(bot.lastCheckLog, 'utf8', function (err, data) {
					if (err) { throw err; }
					console.log("Last check: ".blue + data);
					bot.lastCheck = data;
					bot.fetchFeed();
				});
			} else {
				bot.lastCheck = new Date() - 3600000;
				bot.lastCheck = new Date(bot.lastCheck);
				bot.fetchFeed();
			}
		});
		fs.appendFileSync(bot.log, entry);
	},
	writeOut: function () {
		var log = bot.lastCheck = Date();
		fs.writeFile(bot.lastCheckLog, log, function (err) {
			if (err) {
				console.log("Error: " + err.message);
				return;
			}
			console.log('Wrote out last check: ' + log);
		});
	},
	readFeed: function (error, meta, articles) {
		var lc = new Date(bot.lastCheck),
			now = new Date(),
			t, u, i;
		if (error) {
			console.log("readFeed: " + error);
		} else {
			articles.forEach(function (article, index) {
				t = new Date(article.pubdate),
				u = [],
				index = index + 1;
				if (t > lc && t < now) {
					u.push(article.title, article.link);
					bot.posts.push(u);
					console.log(index.toString().yellow.bold + ") " + article.title.slice(0, 40).bold + " : " + t.toString().slice(0, 25).bold);
				}
			});
		}
	},
	logger: function (log, line) {
		var entry;
		if (line) {
			fs.appendFileSync(bot.log, line);
		} else {
			log.forEach(function (e) {
				entry = 'Title: ' + e[0] + '\n' + 'Link: ' + e[1] + '\n';
				fs.appendFileSync(bot.log, entry);
			});
		}
	},
	handlePost: function () {
		var feedEnd;
		if (bot.posts.length) {
			bot.submit(bot.posts[bot.posts.length - 1][0], bot.posts[bot.posts.length - 1][1], 'SUBREDDIT_NAME_HERE');
			bot.posts.pop();
		} else {
			clearInterval(bot.postTimer);
			bot.logger(null, '\n*** End log: ' + Date());
			bot.writeOut();
		}
	},
	publishPosts: function () {
		var i, len;
		bot.posts = bot.posts.sort(function () {
			return 0.5 - Math.random();
		});
		bot.logger(bot.posts);
		bot.handlePost();
		bot.postTimer = setInterval(bot.handlePost, 100000);
	},
	filterPosts: function () {
		var i, title, url;
		console.log('\n' + bot.brk);
		for (i = bot.posts.length - 1;i >= 0; i -= 1) {
			title = bot.posts[i][0];
			url = bot.posts[i][1];
			if ( (bot.regex.sample.test(url) ) {
				console.log("\nFiltered: ".red + title.slice(0, 20).blue + " : " + url.slice(5, 45).blue);
				bot.logger(null, 'Filtered: ' + title + ' : ' + url);
				bot.posts.splice(i, 1);
			}
		}
		console.log('\n' + bot.brk);
		if (bot.posts.length) {
			bot.publishPosts();
		} else {
			console.log("\n" + "No new content.".grey);
			bot.logger(null, '\nNo new content.');
			bot.logger(null, '\n*** End log: ' + Date());
			bot.writeOut();
		}
	},
	regex: {
		sample: /\/somesampletexttofilter\//i
	},
	handleFeed: function () {
		if (feedList.length) {
			console.log("Parsing: ".bold.underline + feedList[feedList.length - 1].yellow);
			feedparser.parseUrl(feedList[feedList.length - 1], bot.readFeed);
			feedList.pop();
		} else {
			clearInterval(bot.feedTimer);
			bot.filterPosts();
		}
	},
	fetchFeed: function () {
		try {
			bot.feedTimer = setInterval(bot.handleFeed, 5000);
		} catch (err) {
			console.log(err.red);
		}
	}
};
console.log("FIRED: ".cyan.bold + Date().green.underline);

// Populate the two sets of empty quotes with your bot's user name and password

bot.login('', '');
