var express = require('express');
var router = express.Router();

var CronJob = require('cron').CronJob;
var moment = require('moment');
var fs = require('fs');
var request = require('request');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Unkaitter' });
});

//var cronTime = '0 0 7 * * *';
var cronTime = '0 * * * * *';

new CronJob({
	cronTime: cronTime,
	onTick: function() {
		tweet();

		var picStream = fs.createWriteStream('public/images/img.jpg');
		picStream.on('close', function(){
			console.log('file done.');
		});
		picStream.on('error', function(err){
			console.log(err);
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
