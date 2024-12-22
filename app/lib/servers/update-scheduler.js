var getApp;
var queue;
var STALE_AGE = process.env.SERVER_STALE_AGE || 7;
var STALE_UNIT = process.env.SERVER_STALE_UNIT || 'DAY';
var REFRESH_INTERVAL = process.env.SERVER_REFRESH_INTERVAL || 6;
var REFRESH_UNIT = process.env.SERVER_REFRESH_UNIT || 'HOUR';

updateScans = function() {
    getApp().getMQChannel(function(ch) {
        //ch.on('error', console.log);
        //ch.on('close', console.log);
        //ch.on('drain', console.log);
        //ch.on('return', console.log);
    
        if (!ch || ch == null) {
            return console.log("Could not get message queue channel");
        }
        console.log('Sending commands to queue: range-scan-queue');
        getApp().getMySQLPool().query("SELECT sid,address,port,last_ping FROM servers GROUP BY address", [], function(err, rows, fields) {
            if(err) {
                return console.log(err);
            }
            if(rows.length > 0) {
                console.log("Sending request to rescan " + rows.length + " servers.")
            }
            var servers = [];
            rows.forEach((server) => {
                ch.sendToQueue("range-scan-queue", new Buffer.from(JSON.stringify({
                    task: "scan",
                    range: server.address + '/32',
                    ports: "1024-65535",
                    allow_requeue: false
                })), {}, (err, ok) => {
                    if (err) { console.log(err); return; }
                    console.log("Sent scan request to queue for " + server.address);
                });
            })
        })
    });
}

updatePings = function() {
    getApp().getMQChannel(function(ch) {
        //ch.on('error', console.log);
        //ch.on('close', console.log);
        //ch.on('drain', console.log);
        //ch.on('return', console.log);
    
        if (!ch || ch == null) {
            return console.log("Could not get message queue channel");
        }
        console.log('Sending commands to queue: ' + queue);
        getApp().getMySQLPool().query("SELECT sid,address,port,last_ping FROM servers WHERE last_ping >= DATE_SUB(NOW(), INTERVAL "+STALE_AGE+" "+ STALE_UNIT +") AND last_ping <= DATE_SUB(NOW(), INTERVAL "+REFRESH_INTERVAL+" "+REFRESH_UNIT+")", [], function(err, rows, fields) {
            if(err) {
                return console.log(err);
            }
            if(rows.length > 0) {
                console.log("Sending ping request to " + rows.length + " servers.")
            }
            var servers = [];
            rows.forEach((row) => {
                servers.push({address: row.address, port: row.port});
            })
            while(servers.length > 0) {
                ch.sendToQueue(queue, new Buffer.from(JSON.stringify({ task: "multi-ping", servers: servers.splice(0, 500), allow_requeue: true })), {}, function (err, ok) {
                    if (err) { console.log(err); return; }
                    console.log("Sent ping request to queue. " + servers.length + " servers left.");
                });
            }
        })
    });
}
exports.load = function(getAppFunc) {
    getApp = getAppFunc;
    queue = getApp().config.message_queue.queue_name;
    //comment these out for now because I'm restarting the app frequently and don't want to spam the queue.
    //updatePings();
    //updateScans();
    var timer = setInterval(updatePings, 2*(60*(60*1000)))
    //var timer2 = setInterval(updateScans, 24*(60*(60*1000)))
}