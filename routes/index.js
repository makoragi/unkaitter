var express = require('express');
var router = express.Router();

var CronJob         = require('cron').CronJob;
var CronJobWet      = require('cron').CronJob;
var CronJobForecast = require('cron').CronJob;
var CronJobMention  = require('cron').CronJob;
var moment  = require('moment');
var fs      = require('fs');
var request = require('request');
var cheerio = require('cheerio');

var Twit = require('twit');
var Tw = new Twit({
    consumer_key: process.env.twitterConsumerKey,
    consumer_secret: process.env.twitterConsumerSecret,
    access_token: process.env.twitterAccessToken,
    access_token_secret: process.env.twitterAccessSecret
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {
  	title: 'Unkaitter',
  	message: cronTime
  });
});

var cronTime = process.env.cron || '0 0 6-10,22 * * *';
var cronTimeWet = process.env.cronWet || '0 0 0-5,11-21,23 * * *';
var cronTimeForecast = process.env.cronForecast || '0 30 22 * * *';
var cronTimeMention = process.env.cronMention || '0 50 23 * * *';
//var urlWet = "http://www.tenki.jp/amedas/9/46/86156.html"; //阿蘇山
var urlWet = "http://www.tenki.jp/amedas/9/46/86111.html"; //阿蘇乙姫
// var urlWet = "http://www.tenkiaaaaaa.jp/amedas/9/46/86156.html"; //DEBUG
// var urlForecast = "http://www.tenki.jp/forecast/9/46/8620/43214.html";
var urlForecast = "http://weather.yahoo.co.jp/weather/jp/43/8620/43214.html";
var urlCamera = 'http://today3.aso.ne.jp/SnapshotJPEG?Resolution=640x480&Quality=Clarity&View=Normal';
var regexp_temp = /\D(\d+\.\d+)℃/;
var regexp_wind = /\D(\d+\.\d+)m\/s/;
var regexp_wind_f = /.*(\d+).*/;
var regexp_rain = /\D(\d+\.\d+)mm/;
var regexp_wed_f = /\n(.+)/;
var regexp_mention = /^\@unkaitterbot\s+(\d)/;
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
		logging_time();
		request({url: urlWet}, function(err, res, body) {
			if (!err && res.statusCode == 200) {
				get_weather(body);
				var picStream = fs.createWriteStream(tempfile);
				picStream.on('close', function(){
					tweet_image();
				});
				picStream.on('error', function(err){
					console.error(err);
				});
				request(urlCamera).pipe(picStream);
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
		logging_time();
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
		logging_time();
		request({url: urlForecast}, function(err, res, body) {
			if (!err && res.statusCode == 200) {
				get_forecast(body);
				tweet_forecast();
			} else {
				console.error(err);
			}
		});
	},
	start: true
});

new CronJobMention({
	cronTime: cronTimeMention,
	onTick: function() {
		logging_time();
		request({url: urlWet}, function(err, res, body) {
			if (!err && res.statusCode == 200) {
				tweet_mention();
			} else {
				console.error(err);
			}
		});
	},
	start: true
});

/////////////////////////////////////////////////////////////////////

function logging_time() {
	var message = 'ただいま' + get_time_now() + 'です';
	console.log(message);
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
					status: '現在の気温' + temp[0] + '℃ '
						+ '現在の風速' + wind[0] + 'm/s '
						+ '現在の降水量' + rain[1] + 'mm '
						+ get_time_now()
						+ ' [阿蘇山(標高1142m)観測不能のため阿蘇乙姫(標高497m)を測定]',
					media_ids: [mediaIdStr]
				};
				tweet_status_update(params);
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
			if (i == 1 && $(this).prev().text() == '気温') {
				temp = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_temp.exec($(this).text())) !== null) {
						temp[j] = myArray[1];
					} else {
						temp[j] = '--';
					}
				});
			} else if (i == 1 && $(this).prev().text() == '風向・風速') {
				wind = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_wind.exec($(this).text())) !== null) {
						wind[j] = myArray[1];
					} else {
						wind[j] = '--';
					}
				});
			} else if (i == 1 && $(this).prev().text() == '降水量') {
				rain = [];
				$(this).find('li').each(function(j, elem){
					if ((myArray = regexp_rain.exec($(this).text())) !== null) {
						rain[j] = myArray[1];
					} else {
						rain[j] = '--';
					}
				});
			}
		});
	});
}

function tweet_weather() {
	var params = {
		status: '現在の気温' + temp[0] + '℃ '
			+ '現在の風速' + wind[0] + 'm/s '
			+ '現在の降水量' + rain[1] + 'mm '
			+ get_time_now()
			+ ' [阿蘇山(標高1142m)観測不能のため阿蘇乙姫(標高497m)を測定]'
	};
	tweet_status_update(params);
}

function get_forecast(body) {
	var $ = cheerio.load(body);
	wed_f = [];
	temp_f = [];
	wind_f = [];
	temp_f_max = 0;
	$("div[id=yjw_pinpoint_today] table[class=yjw_table2]")
	.first().children().each(function(itr){
		//// <tr>
		$(this).children().each(function(i, elem){
			// console.log($(this));
			//// <th> or <td>
			if (itr == 2 && i != 0) {
				// console.log(i + ':' + $(this).text());
				if (Number(temp_f_max) < Number($(this).text()) {
					temp_f_max = $(this).text();
					console.log(' max:' + $(this).text());
				}
			}
		});
	});
	$("div[id=yjw_pinpoint_tomorrow] table[class=yjw_table2]")
	.first().children().each(function(itr){
		//// <tr>
		$(this).children().each(function(i, elem){
			//// <th> or <td>
			if (i == 0) {
				// console.log('itr=' + itr + ':' + $(this).text());
			}
			if (itr == 1) {
				if ((myArray = regexp_wed_f.exec($(this).text())) !== null) {
					wed_f[i] = myArray[1];
				} else {
					wed_f[i] = '--';
				}
			} else if (itr == 2) {
				temp_f[i] = $(this).text();
			} else if (itr == 5) {
				if ((myArray = regexp_wind_f.exec($(this).text())) !== null) {
					wind_f[i] = myArray[1];
				} else {
					wind_f[i] = '--';
				}
			}
		});
	});
}

function tweet_forecast() {
	var params = {
		status: '[予報] '
			+ '明日6時(' + wed_f[3] + ' ' + temp_f[3] + '℃ '
			+ '風速' + wind_f[3] + 'm/s) '
			+ '明日9時(' + wed_f[4] + ' ' + temp_f[4] + '℃ '
			+ '風速' + wind_f[4] + 'm/s) '
			+ '気温差(本日最高-明日6時 '
			+ (temp_f_max - temp_f[3]) + '℃) '
			+ get_time_now()
	};
	tweet_status_update(params);
}

var imgList = {};

function tweet_mention() {
	imgList = {};
	var params = {
		screen_name: 'unkaitterbot',
		count: 30,
		trim_user: true,
		exclude_replies: true,
		include_rts: true
	};
	Tw.get('statuses/user_timeline', params, function(err, data, response){
		if (!err && response.statusCode == 200) {
			data.forEach(function(elm, index, array){
				// console.log('a[' + index + ']');
				if ('extended_entities' in elm &&
					is_today(elm.created_at)) {
					set_img_list(elm);
					// console.log(elm);
				}
			});
			process_mention();
		} else {
			console.error(err);
		}
	});
}

function process_mention() {
	var params = {
		trim_user: true
	};
	Tw.get('statuses/mentions_timeline', params, function(err, data, response){
		if (!err && response.statusCode == 200) {
			data.forEach(function(elm, index, array){
				if (is_today(elm.created_at) &&
					elm.in_reply_to_status_id_str != 'null' &&
					elm.in_reply_to_status_id_str in imgList &&
					(myArray = regexp_mention.exec(elm.text)) !== null) {
					//
					if (myArray[1] == '1') {
						imgList[elm.in_reply_to_status_id_str].count_ok += 1;
					} else {
						imgList[elm.in_reply_to_status_id_str].count_ng += 1;
					}
				}
			});
			var hours = '';
			for (i in imgList) {
				if (imgList[i].count_ok > imgList[i].count_ng) {
					if (hours == '') {
						hours = imgList[i].hour;
					} else {
						hours = imgList[i].hour + ',' + hours;
					}
				}
			}
			var st = '';
			if (hours != '') {
				st = '雲海が本日' + hours + '時に見えました';
			} else {
				st = '雲海は本日見えませんでした'
			}
			var param_update = {
				status: '[集計] ' + st + ' ' + get_time_now()
			};
			tweet_status_update(param_update);
		} else {
			console.error(err);
		}
	});
}

function tweet_status_update(params) {
	var debug = process.env.debug || 0;
	if (debug) {
		console.log(params.status);
	} else {
		Tw.post('statuses/update', params, function(err, data, response){
			// console.log(data);
		});
	}
}

function get_time_now() {
	return moment().utc().add(9, 'h').format("MM月DD日 HH時mm分");
}

function is_today(created) {
	date = new Date(created);
	today = new Date();
	return date.getDate() == today.getDate();
}
function set_img_list(data) {
	date = new Date(data.created_at);
	imgList[data.id_str] = {
		hour: date.getHours(),
		count_ok: 0,
		count_ng: 0
	};
}

module.exports = router;
