/**
 * @file server.js [strong loop node server master file]
 * @author Lijo
 * @version 0.1
 * Usage :- Analytics Chat bot
 */

'use strict';

//include loopback lib
var loopback = require('loopback');
//include boot lib
var boot = require('loopback-boot');
//Loopback app object
var app = module.exports = loopback();

//Booting fucntion
app.start = function() {
    // start the web server
    return app.listen(function() 
	{
		//call the client side socket function "started" on startup.
        app.emit('started');
        var baseUrl = app.get('url').replace(/\/$/, '');
        console.log('Web server listening at: %s', baseUrl);
        if (app.get('loopback-component-explorer')) {
            var explorerPath = app.get('loopback-component-explorer').mountPath;
            console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
        }
    });
};

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
    if (err) throw err;

    // start the server if `$ node server.js`
    if (require.main === module)
        app.io = require('socket.io')(app.start());
	
	//Trigger this server side function once a client joins to the socket.
    app.io.on('connection', function(socket) {
		
        //console.log('a user connected');
		//Trigger this server side function once a client leaves from the socket.
        socket.on('disconnect', function() {
            //console.log('user disconnected');
			// Once a user disconnected from socket. System will calculates the vistor duration and display a chat bot which says 
			// A visitor from XXX City, YYY Country has just bounced off your site. He was here for just XX Duration Seconds.
            setTimeout(function() 
			{
                if (typeof socket.fng_log_vid != 'undefined') 
				{
					//Databse model object.
                    var Log = app.models.Log;
                    Log.findOne({
                        where: {
                            id: socket.fng_log_vid
                        }
                    }, function(err, log_data) {
                        if (!err) {
                            var page_count = Number(log_data.page_count);
                            console.log(page_count);
							//If the page count of the site visitor is one then it will consider as a bounced visitor.
                            if (page_count == 1) {
                                if (log_data.city != '' && log_data.country != '') {
                                    var t1 = new Date();
                                    var t2 = log_data.start_time;
                                    var dif = t1.getTime() - t2.getTime();
                                    var Seconds_from_T1_to_T2 = dif / 1000;
                                    var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2)
                                    var bot_master_text = 'A visitor from ' + log_data.city + ' , ' + log_data.country + ' has just bounced off your site. He was here for just ' + Seconds_Between_Dates + ' Seconds.';
                                } else if (log_data.city != '') {
                                    var t1 = new Date();
                                    var t2 = log_data.start_time;
                                    var dif = t1.getTime() - t2.getTime();
                                    var Seconds_from_T1_to_T2 = dif / 1000;
                                    var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2)
                                    var bot_master_text = 'A visitor from ' + log_data.city + ' has just bounced off your site. He was here for just ' + Seconds_Between_Dates + ' Seconds.';

                                } else if (log_data.country != '') {
                                    var t1 = new Date();
                                    var t2 = log_data.start_time;
                                    var dif = t1.getTime() - t2.getTime();
                                    var Seconds_from_T1_to_T2 = dif / 1000;
                                    var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2)
                                    var bot_master_text = 'A visitor from ' + log_data.country + ' has just bounced off your site. He was here for just ' + Seconds_Between_Dates + ' Seconds.';

                                } else {
                                    var t1 = new Date();
                                    var t2 = log_data.start_time;
                                    var dif = t1.getTime() - t2.getTime();
                                    var Seconds_from_T1_to_T2 = dif / 1000;
                                    var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2)
                                    var bot_master_text = 'A visitor has just bounced off your site. He was here for just ' + Seconds_Between_Dates + ' Seconds.';

                                }

                                var res = Log.find({
                                    where: {
                                        client_id: socket.client_id
                                    }
                                }, function(err, log_data) {
                                    if (!err) {
                                        var itemsProcessed = 0;
                                        var total_bounce_visit = 0;
                                        var total_page_count = 0;
                                        var sum = 0;
                                        log_data.forEach((item, index, array) => {
                                            itemsProcessed++;
                                            if (item.page_count == 1) {
                                                total_bounce_visit++;
                                            }
                                            if (typeof item.page_count != 'undefined') {
                                                total_page_count = total_page_count + Number(item.page_count);
                                            }
                                            console.log(item.page_count);
                                            if (itemsProcessed === log_data.length) {
                                                socket.to(socket.client_id).emit('do_bot', {
                                                    'bot_master_text': bot_master_text,
                                                    'total_visit': itemsProcessed,
                                                    'total_bounce_visit': total_bounce_visit,
                                                    'total_page_count': total_page_count
                                                });
                                            }
                                        });
                                    }
                                });
                            }
                        }

                    });
                }
            }, 1500);


        });
	
		// This server side event will be triggerd from the client socket.
		// Visitor basic details will be push to the Log modedl (Mongo DB)
        socket.on('create_visitor', function(data, fn) {
            socket.client_id = data.client_id;

            var Log = app.models.Log;
            var tmp_data = {};
			// As a part of internal checking all our development system will return local ip address.
			// Maxmind api only returns location details for the real ip address.
			// So at the time moment we will override the system IP with our randomIp ip.
            tmp_data.ip = randomIp();
            tmp_data.start_time = new Date();
            tmp_data.browser = data.browserName;
            tmp_data.os = data.OSName;
            tmp_data.client_id = data.client_id;
            tmp_data.visitor_id = data.fng_log_vid;
            tmp_data.country = '';
            tmp_data.city = '';
            tmp_data.page_count = 1;
			//Loading Maxmind lib , to identify the visitor location from the ip address.
            var maxmind = require('maxmind');
            var path = require('path');
            maxmind.open(path.join(__dirname, 'GeoLite2-City.mmdb'), (err, cityLookup) => {
                var city = cityLookup.get(tmp_data.ip);
                if (city != null && typeof city != 'undefined') {
                    if (typeof city.city != 'undefined') {
                        if (typeof city.city.names != 'undefined') {
                            if (typeof city.city.names.en != 'undefined') {
                                tmp_data.city = city.city.names.en;
                            }
                        }
                    }
                }
                if (city != null && typeof city != 'undefined') {
                    if (typeof city.country != 'undefined') {
                        if (typeof city.country.names != 'undefined') {
                            if (typeof city.country.names.en != 'undefined') {
                                tmp_data.country = city.country.names.en;
                            }
                        }
                    }
                }
				//Insert in DB
                var careated_data = Log.create(tmp_data, function(err, result_data) {
                    fn({
                        'fng_log_vid': result_data.id
                    });
                    socket.fng_log_vid = result_data.id;
                    var log_url = app.models.log_url;
                    var tmp_data = {};
                    tmp_data.visitor_id = result_data.id;
                    tmp_data.time = new Date();
                    tmp_data.url = data.location;
                    var careated_data = log_url.create(tmp_data, function(err, data) {});

                    var boat_goal = app.models.boat_goal;
                    var d = new Date();
                    boat_goal.findOne({
                        where: {
                            client_id: socket.client_id
                        }
                    }, function(err, boat_goal_data) {
                        if (!err) {
                            console.log(boat_goal_data);
                            Log.find({
                                where: {
                                    client_id: socket.client_id
                                }
                            }, function(err, log_data) {
                                if (!err) {
                                    var itemsProcessed = 0;
                                    var total_bounce_visit = 0;
                                    var total_page_count = 0;
                                    var sum = 0;
                                    log_data.forEach((item, index, array) => {
                                        itemsProcessed++;
                                        if (item.page_count == 1) {
                                            total_bounce_visit++;
                                        }
                                        if (typeof item.page_count != 'undefined') {
                                            total_page_count = total_page_count + item.page_count;
                                        }
                                        if (itemsProcessed === log_data.length) {
                                            if (typeof boat_goal_data != 'undefined' && boat_goal_data != null) {

                                                if (typeof boat_goal_data.total_visit_count_day != 'undefined') {
                                                    if (boat_goal_data.total_visit_count_day > 0) {
                                                        if (boat_goal_data.total_visit_count_day == itemsProcessed) {
                                                            var bot_master_text = 'Congrats , you have achived your goal for the day. There where ' + itemsProcessed + ' visitors today.';
                                                            socket.to(socket.client_id).emit('do_bot', {
                                                                'bot_master_text': bot_master_text,
                                                                'total_visit': itemsProcessed,
                                                                'total_bounce_visit': total_bounce_visit,
                                                                'total_page_count': total_page_count
                                                            });
                                                        }
                                                    }
                                                }


                                                if (typeof boat_goal_data.page_count_visitor != 'undefined') {
                                                    if (boat_goal_data.page_count_visitor > 0) {
                                                        if (boat_goal_data.page_count_visitor == total_page_count) {
                                                            var bot_master_text = 'Congrats , users now tend to hangout longer on your site. The total page views on your site have reached ' + total_page_count + '.';
                                                            socket.to(socket.client_id).emit('do_bot', {
                                                                'bot_master_text': bot_master_text,
                                                                'total_visit': itemsProcessed,
                                                                'total_bounce_visit': total_bounce_visit,
                                                                'total_page_count': total_page_count
                                                            });
                                                        }
                                                    }
                                                }




                                            }
                                        }

                                    });
                                }
                            });

                        }
                    });

                });
            });

        });
        socket.on('log_visitor', function(data) {
            socket.client_id = data.client_id;
            socket.fng_log_vid = data.fng_log_vid;
            var log_url = app.models.log_url;
            var tmp_data = {};
            tmp_data.visitor_id = data.fng_log_vid;
            tmp_data.time = new Date();
            tmp_data.url = data.location;
            var careated_data = log_url.create(tmp_data, function(err, data) {});
            var Log = app.models.Log;
            Log.findOne({
                where: {
                    id: tmp_data.visitor_id
                }
            }, function(err, log_data) {
                var page_count = 0;
                if (typeof log_data.page_count != 'undefined') {
                    page_count = Number(log_data.page_count) + 1;
                }
                Log.update({
                    id: tmp_data.visitor_id
                }, {
                    'page_count': page_count
                }, function(err, log_data) {});
            });
            var boat_goal = app.models.boat_goal;
            boat_goal.findOne({
                where: {
                    client_id: socket.client_id
                }
            }, function(err, boat_goal_data) {
                if (!err) {
                    console.log(boat_goal_data);
                    Log.find({
                        where: {
                            client_id: socket.client_id
                        }
                    }, function(err, log_data) {
                        if (!err) {
                            var itemsProcessed = 0;
                            var total_bounce_visit = 0;
                            var total_page_count = 0;
                            var sum = 0;
                            log_data.forEach((item, index, array) => {
                                itemsProcessed++;
                                if (item.page_count == 1) {
                                    total_bounce_visit++;
                                }
                                if (typeof item.page_count != 'undefined') {
                                    total_page_count = total_page_count + item.page_count;
                                }
                                if (itemsProcessed === log_data.length) {
                                    if (typeof boat_goal_data != 'undefined' && boat_goal_data != null) {
                                        if (typeof boat_goal_data.page_count_visitor != 'undefined') {
                                            if (boat_goal_data.page_count_visitor > 0) {
                                                if (boat_goal_data.page_count_visitor == total_page_count) {
                                                    var bot_master_text = 'Congrats , users now tend to hangout longer on your site. The total page views on your site have reached ' + total_page_count + '.';
                                                    socket.to(socket.client_id).emit('do_bot', {
                                                        'bot_master_text': bot_master_text,
                                                        'total_visit': itemsProcessed,
                                                        'total_bounce_visit': total_bounce_visit,
                                                        'total_page_count': total_page_count
                                                    });
                                                }
                                            }
                                        }

                                    }
                                }

                            });
                        }
                    });

                }
            });

        });

        socket.on('add_to_chanel', function(data) {
            socket.join(data);
        });

    });



});

/**
   * Function getCity_Country.
   * Function to identify the city and country from the user IP address using Maxmind API.
   * @param {String} ip - Client user IP address.
*/
function getCity_Country(ip) {
    var maxmind = require('maxmind');
    var path = require('path');

    var country = '';
    var city = '';
    maxmind.open(path.join(__dirname, 'GeoLite2-City.mmdb'), (err, cityLookup) => {
        var city = cityLookup.get(ip);
        if (city != null && typeof city != 'undefined') {
            if (typeof city.city != 'undefined') {
                if (typeof city.city.names != 'undefined') {
                    if (typeof city.city.names.en != 'undefined') {
                        city = city.city.names.en;
                    }
                }
            }
        }
        if (city != null && typeof city != 'undefined') {
            if (typeof city.country != 'undefined') {
                if (typeof city.country.names != 'undefined') {
                    if (typeof city.country.names.en != 'undefined') {
                        country = city.country.names.en;
                        //console.log(country);
                    }
                }
            }
        }

    });
	/**
    * @returns {Object} with city and country name.
    */
    return {
        'city': city,
        'country': country
    };
}

/**
   * Function randomByte.
   * Function to get random number.
*/

function randomByte() {
	/**
    * @returns {Number} random number.
    */
    return Math.round(Math.random() * 256);
}

function randomIp() {
    var ip = randomByte() + '.' +
        randomByte() + '.' +
        randomByte() + '.' +
        randomByte();
    if (isPrivate(ip)) return randomIp();
    return ip;
}

function isPrivate(ip) {
    return /^10\.|^192\.168\.|^172\.16\.|^172\.17\.|^172\.18\.|^172\.19\.|^172\.20\.|^172\.21\.|^172\.22\.|^172\.23\.|^172\.24\.|^172\.25\.|^172\.26\.|^172\.27\.|^172\.28\.|^172\.29\.|^172\.30\.|^172\.31\./.test(ip);
}


var privateIps = [
    '10.0.0.0',
    '10.255.255.255',
    '172.16.0.0',
    '172.31.255.255',
    '192.168.0.0',
    '192.168.255.255'
];

var publicIps = [
    '0.0.0.0',
    '255.255.255.255',
];
