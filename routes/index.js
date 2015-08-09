var express = require('express');
var router = express.Router();

var CronJob = require('cron').CronJob;
var CronJobWet = require('cron').CronJob;
var CronJobForecast = require('cron').CronJob;
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

var cronTime = process.env.cron || '0 0 6-10,22 * * *';
var cronTimeWet = process.env.cronWet || '0 0 0-5,11-21,23 * * *';
var cronTimeForecast = process.env.cronForecast || '0 0 22 * * *';
var urlWet = "http://www.tenki.jp/amedas/9/46/86156.html";
// var urlWet = "http://www.tenkiaaaaaa.jp/amedas/9/46/86156.html"; //DEBUG
// var urlForecast = "http://www.tenki.jp/forecast/9/46/8620/43214.html";
var urlForecast = "http://weather.yahoo.co.jp/weather/jp/43/8620/43214.html";
var regexp_temp = /\D(\d+\.\d+)℃/;
var regexp_wind = /\D(\d+\.\d+)m\/s/;
var regexp_wind_f = /.*(\d+).*/;
var regexp_rain = /\D(\d+\.\d+)mm/;
var regexp_wed_f = /\n(.+)/;
var temp = [];
var wind = [];
var rain = [];
var wed_f = [];
var temp_f = [];
var wind_f = [];
var rain_f = [];
var temp_f_max = 0;
var tempfile = process.env.tempdir + '/img.jpg';

new CronJob({
	cronTime: cronTime,
	onTick: function() {
		tweet();

		request({url: urlWet}, function(err, res, body) {
			if (!err && res.statusCode == 200) {
				get_weather(body);

				var picStream = fs.createWriteStream(tempfile);
				picStream.on('close', function(){
					tumblr_image();
					tweet_image();
				});

				picStream.on('error', function(err){
					console.error(err);
				});

				request('http://today3.aso.ne.jp/SnapshotJPEG?Resolution=640x480&Quality=Clarity&View=Normal').pipe(picStream);

			} else {
				console.error(err);
			}
		});

	},
	start: true
});

new CronJobWet({
	cronTime: cronTimeWet,
	onTick: function() {
		tweet();

		request({url: urlWet}, function(err, res, body) {
			if (!err && res.statusCode == 200) {

				get_weather(body);
				tweet_weather();

			} else {
				console.error(err);
			}
		});
	},
	start: true
});

new CronJobForecast({
	cronTime: cronTimeForecast,
	onTick: function() {
		tweet();

		request({url: urlForecast}, function(err, res, body) {
			if (!err && res.statusCode == 200) {

				// get_weather(body);
				get_forecast(body);
				tweet_forecast();

			} else {
				console.error(err);
			}
		});
	},
	start: true
});

/////////////////////////////////////////////////////////////////////

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
					// status: moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。"),
					status: '現在の気温' + temp[0] + '℃ '
						+ '24H以内の温度差' + (temp[1] - temp[2]).toFixed(1) + '℃ '
						+ '現在の風速' + wind[0] + 'm/s '
						+ '現在の降水量' + rain[1] + 'mm '
						+ moment().utc().add(9, 'h').format("MM月DD日 HH時mm分"),
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

function get_weather(body) {
	var $ = cheerio.load(body);
	$("table[class=amedas_table_current]").first().children().each(function(){
		//// <tr>
		$(this).children().each(function(i, elem){
			//// <th> or <td>
			// console.log($(this));
			// if (i == 1) {
			// 	console.log($(this).prev().text());
			// }
			if (i == 1 && $(this).prev().text() == '気温') {
				// console.log($(this));
				temp = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_temp.exec($(this).text())) !== null) {
						temp[j] = myArray[1];
					}
				});
				// console.log('現在の気温' + temp[0] + '℃');
				// console.log('24H以内の温度差' + (temp[1] - temp[2]).toFixed(1) + '℃');
			} else if (i == 1 && $(this).prev().text() == '風向・風速') {
				// console.log($(this));
				wind = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_wind.exec($(this).text())) !== null) {
						wind[j] = myArray[1];
					}
				});
				// console.log('現在の風速' + wind[0] + 'm/s');
			} else if (i == 1 && $(this).prev().text() == '降水量') {
				// console.log($(this));
				rain = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_rain.exec($(this).text())) !== null) {
						rain[j] = myArray[1];
					}
				});
				// console.log('現在の降水量' + rain[1] + 'mm');
			}
		});
	});
}

function tweet_weather() {
	var params = {
		// status: moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。")
		status: '現在の気温' + temp[0] + '℃ '
			+ '24H以内の温度差' + (temp[1] - temp[2]).toFixed(1) + '℃ '
			+ '現在の風速' + wind[0] + 'm/s '
			+ '現在の降水量' + rain[1] + 'mm '
			+ moment().utc().add(9, 'h').format("MM月DD日 HH時mm分")
	};
	Tw.post('statuses/update', params, function(err, data, response){
		// console.log(data);
	});
}

function get_forecast(body) {
	var $ = cheerio.load(body);
	// console.log($("div[id=yjw_pinpoint_tomorrow] table[class=yjw_table2]").first());
	wed_f = [];
	temp_f = [];
	wind_f = [];
	temp_f_max = 0;
	$("div[id=yjw_pinpoint_today] table[class=yjw_table2]").first().children().each(function(itr){
		//// <tr>
		$(this).children().each(function(i, elem){
			// console.log($(this));
			//// <th> or <td>
			if (itr == 2 && i != 0) {
				// console.log(i + ':' + $(this).text());
				if (temp_f_max < $(this).text()) {
					temp_f_max = $(this).text();
					// console.log(' max:' + $(this).text());
				}
			}
		});
	});
	$("div[id=yjw_pinpoint_tomorrow] table[class=yjw_table2]").first().children().each(function(itr){
		//// <tr>
		$(this).children().each(function(i, elem){
			// console.log($(this));
			//// <th> or <td>
			if (i == 0) {
				// console.log('itr=' + itr + ':' + $(this).text());
			}
			if (itr == 1) {
				// console.log(i + ':' + $(this).text());
				if ((myArray = regexp_wed_f.exec($(this).text())) !== null) {
					// console.log(myArray[1]);
					wed_f[i] = myArray[1];
				}
			} else if (itr == 2) {
				// console.log(i + ':' + $(this).text());
				temp_f[i] = $(this).text();
			} else if (itr == 5) {
				// console.log(i + ':' + $(this));
				if ((myArray = regexp_wind_f.exec($(this).text())) !== null) {
					// console.log(myArray[1]);
					wind_f[i] = myArray[1];
				}
			}
		});
	});
}

function tweet_forecast() {
	var params = {
		// status: moment().utc().add(9, 'h').format("ただいま MM月DD日 HH時mm分です。")
		status: '[予報] '
			+ '明日6時(' + wed_f[3] + ' ' + temp_f[3] + '℃ ' + '風速' + wind_f[3] + 'm/s) '
			+ '明日9時(' + wed_f[4] + ' ' + temp_f[4] + '℃ ' + '風速' + wind_f[4] + 'm/s) '
			+ '気温差(本日最高-明日6時 ' + (temp_f_max - temp_f[3]) + '℃) '
			+ moment().utc().add(9, 'h').format("MM月DD日 HH時mm分")
	};
	Tw.post('statuses/update', params, function(err, data, response){
		// console.log(data);
	});
}

module.exports = router;
