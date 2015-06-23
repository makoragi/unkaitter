var express = require('express');
var router = express.Router();

var CronJob = require('cron').CronJob;
var moment = require('moment');
var fs = require('fs');
var request = require('request');

var Tumblr = require('tumblrwks');
var tumblr = new Tumblr(
  {
    consumerKey: process.env.tumblrConsumerKey,
    consumerSecret: process.env.tumblrConsumerSecret,
    accessToken: process.env.tumblrAccessToken,
    accessSecret: process.env.tumblrAccessSecret
  }, 'unkaitter.tumblr.com'
);

/* GET home page. */
router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Unkaitter' });
  res.render('index', {
  	title: 'Unkaitter',
  	message: cronTime
  });
});

var cronTime = process.env.cron || '0 0 6-10 * * *';

var tempfile = process.env.tempdir + '/img.jpg';

new CronJob({
	cronTime: cronTime,
	onTick: function() {
		tweet();

		var picStream = fs.createWriteStream(tempfile);
		picStream.on('close', function(){

			var photo = fs.readFileSync(tempfile);
			tumblr.post('/post',
			  {
			    type: 'photo',
			    data: [photo]
			  }, function(err, json) {
			    if (!err) {
			      console.log(json);
			    } else {
			      console.error(err);
			    }
			  }
			);
		});
		picStream.on('error', function(err){
			console.error(err);
		});

		request('http://today3.aso.ne.jp/SnapshotJPEG?Resolution=640x480&Quality=Clarity&View=Normal').pipe(picStream);
	},
	start: true
});

function tweet() {
	var message = moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。");
	console.log(message);
}

module.exports = router;
