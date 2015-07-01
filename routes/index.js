var express = require('express');
var router = express.Router();

var CronJob = require('cron').CronJob;
var CronJobWet = require('cron').CronJob;
var moment = require('moment');
var fs = require('fs');
var request = require('request');
var cheerio = require('cheerio');

var Tumblr = require('tumblrwks');
var tumblr = new Tumblr(
  {
    consumerKey: process.env.tumblrConsumerKey,
    consumerSecret: process.env.tumblrConsumerSecret,
    accessToken: process.env.tumblrAccessToken,
    accessSecret: process.env.tumblrAccessSecret
  }, 'unkaitter.tumblr.com'
);

var Twit = require('twit');
// var Twit = require('twitter');
var Tw = new Twit({
    consumer_key: process.env.twitterConsumerKey,
    consumer_secret: process.env.twitterConsumerSecret,
    access_token: process.env.twitterAccessToken,
    access_token_secret: process.env.twitterAccessSecret
});

/* GET home page. */
router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Unkaitter' });
  res.render('index', {
  	title: 'Unkaitter',
  	message: cronTime
  });
});

var cronTime = process.env.cron || '0 0 6-10 * * *';
var cronTimeWet = process.env.cronWet || '0 0 6-10 * * *';

var tempfile = process.env.tempdir + '/img.jpg';

new CronJob({
	cronTime: cronTime,
	onTick: function() {
		tweet();

		var picStream = fs.createWriteStream(tempfile);
		picStream.on('close', function(){
			tumblr_image();
			tweet_image();
		});

		picStream.on('error', function(err){
			console.error(err);
		});

		request('http://today3.aso.ne.jp/SnapshotJPEG?Resolution=640x480&Quality=Clarity&View=Normal').pipe(picStream);
	},
	start: true
});

var urlWet = "http://www.tenki.jp/amedas/9/46/86156.html";
new CronJobWet({
	cronTime: cronTimeWet,
	onTick: function() {
		tweet();

		request({url: urlWet}, function(err, res, body) {
			if (!err && res.statusCode == 200) {
				var $ = cheerio.load(body);
				$("table[class=amedas_table_current]").first().children().each(function(){
					//
					console.log($(this).children());
				});
			}
		});
		console.log("fin.");
	},
	start: true
});

function tweet() {
	var message = moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。");
	console.log(message);
	// Tw.post('statuses/update', { status: message }, function(err, data, response){
	// 	console.log('Tweet!');
	// });
}

function tumblr_image() {
	tumblr.post('/post',
	  {
	    type: 'photo',
	    data: [ fs.readFileSync(tempfile) ]
	  }, function(err, json) {
	    if (!err) {
	      console.log(json);
	    } else {
	      console.error(err);
	    }
	  }
	);
}

function tweet_image() {
	Tw.post('media/upload',
		{
			media_data: [ fs.readFileSync(tempfile, { encoding: 'base64' }) ]
		},
		function(err, data, response){
			if (!err) {
				var mediaIdStr = data.media_id_string;
				var params = {
					status: moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。"),
					media_ids: [mediaIdStr]
				};
				Tw.post('statuses/update', params, function(err, data, response){
					// console.log(data);
				});
			} else {
				console.error(err);
			}
		}
	);
}

module.exports = router;
