var App = {};
App.args = require('commandos').parse(process.argv);

App.config = {
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'pinger',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'pinger',
        port: process.env.MYSQL_PORT || 3306
    },
    message_queue: {
        queue_name: "range-scanners",
        queue_host: process.env.QUEUE_HOST || 'localhost',
        queue_username: process.env.QUEUE_USERNAME || 'guest',
        queue_password: process.env.QUEUE_PASSWORD || 'guest'
    }
};
const amqplib = require('amqplib/callback_api');
const fs = require('fs');
const mysql = require('mysql');
const axios = require('axios');

var mysqlPool;

App.getMySQLPool = function () {
    if (mysqlPool) { return mysqlPool; }
    else {
        mysqlPool = mysql.createPool({
            connectionLimit: App.config.mysql.connectionLimit, //important
            host: App.config.mysql.host,
            port: App.config.mysql.port,
            user: App.config.mysql.user,
            password: App.config.mysql.password,
            database: App.config.mysql.database,
            debug: false
        });
        return mysqlPool;
    }
}

App.getRootMySQLPool = function () {
    if (mysqlPool && !mysqlPool.user && mysqlPool.user != 'root') { mysqlPool = null; }
    else if (mysqlPool && mysqlPool.user && mysqlPool.user.toString() == 'root') { return mysqlPool; }
    mysqlPool = mysql.createPool({
        connectionLimit: App.config.mysql.connectionLimit, //important
        host: App.config.mysql.host,
        port: App.config.mysql.port,
        user: 'root',
        password: App.config.mysql.root_password,
        debug: false
    });
    return mysqlPool;
}

var queue = App.config.message_queue.queue_name;

//console.log("Attempting connection to RabbitMQ server at " + App.config.message_queue.queue_host);
//console.log("Username:\t" + App.config.message_queue.queue_username);
//console.log("Queue:\t\t" + App.config.message_queue.queue_name);
amqplib.connect('amqp://' + App.config.message_queue.queue_username + ":" + App.config.message_queue.queue_password + "@" + App.config.message_queue.queue_host + "/dev", {}, function (err, conn) {
//    console.log("Connected to " + App.config.message_queue.queue_host);
    conn.createChannel(function (err, ch) {
        ch.on('error', console.log);
        ch.on('close', () => { process.exit(0); });
        ch.on('drain', console.log);
        ch.on('return', console.log);

        if (err) {
            console.log(err);
            return;
        }
        //console.log('Sending command to queue: ' + queue);
        switch (App.args['command']) {
            case 'scan':
                /*
                 * {
                 *   task: "scan",
                 *   range: "172.16.0.0/16",
                 *   ports: "25565-25567"
                 * }
                 */
                if(!App.args['range'] && !App.args['file'] && App.args['asn']) {
                    axios.get('https://api.hackertarget.com/aslookup/?q=' + App.args['asn']).then(function(response) {
                        var ranges = response.data.split("\n");
                        ranges.forEach(function(range) {
                            if(range.match(/#/) || range.match(/:/)) { return; }
                            var request = {
                                task: "scan",
                                range: range,
                                ports: App.args['ports']||"25565"
                            }
                            console.log("Sending scan request for " + request.range + ":"+request.ports+" to queue.");
                            ch.sendToQueue("range-scan-queue", new Buffer.from(JSON.stringify(request)), {}, (err, ok) => {
                                console.log("Sent scan request for " + request.range + ":"+request.ports+" to queue.");
                            });
                        });
                    }).catch(console.log);
                    return;
                }
                if(!App.args['range'] && App.args['file']) {
                    try {
                        var ranges = fs.readFileSync(App.args['file'], 'utf8').toString().split("\n");
                        ranges.forEach(function(range) {
                            var request = {
                                task: "scan",
                                range: range,
                                ports: App.args['ports']||"25565-25565"
                            }
                            console.log("Sending scan request for " + request.range + ":"+request.ports+" to queue.");
                            ch.sendToQueue("range-scan-queue", new Buffer.from(JSON.stringify(request)), {}, (err, ok) => {
                                console.log("Sent scan request for " + request.range + ":"+request.ports+" to queue.");
                            });
                        });
                    } catch(e) {
                        console.log('Error:', e.stack);
                    }
                    return;
                }
                
                var request = {
                    task: "scan",
                    range: App.args['range']||'100.200.0.0/16',
                    ports: App.args['ports']||"25565-25567"
                }
                console.log("Sending scan request for " + request.range + ":"+request.ports+" to queue.");
                ch.sendToQueue("range-scan-queue", new Buffer.from(JSON.stringify(request)), {}, (err, ok) => {
                    console.log("Sent scan request for " + request.range + ":"+request.ports+" to queue.");
                });
                ch.close();
                break;
            case 'multi-ping':
                var pingHostsArrays = [];
                var allHosts;
                if (App.args['json-file']) {
                    try {
                        allHosts = JSON.parse(fs.readFileSync(App.args['json-file'], 'utf8').toString());
                        console.log("Read " + allHosts.length + " hosts from " + App.args['json-file']);
                        while (allHosts.length >= 1) {
                            var newArray = [];
                            allHosts.splice(0, 500).forEach(function (host) {
                                newArray.push({ address: host.address, port: host.port });
                            });
                            pingHostsArrays.push(newArray);
                        }
                    } catch (e) {
                        console.log('Error:', e.stack);
                    }
                } else if (App.args['hosts']) {
                    allHosts = App.args['hosts'].split(",");
                    console.log("Read " + allHosts.length + " hosts from command line");
                    while (allHosts.length >= 1) {
                        var newArray = [];
                        allHosts.splice(0, 500).forEach(function (host) {
                            newArray.push({address: host.split(":")[0], port: host.split(":")[1]});
                        });
                        console.log("Added " + newArray.length + " hosts to be queued.");
                        pingHostsArrays.push(newArray);
                    }
                } else if (App.args['hosts-txt']) {
                    var LINE_SEPARATOR = "\r\n";
                    var allHostsFile = fs.readFileSync(App.args['hosts-txt'], 'utf8').toString();
                    if(allHostsFile.match(/\r\n/)) { LINE_SEPARATOR = "\r\n"; }
                    else if(allHostsFile.match(/\n/)) { LINE_SEPARATOR = "\n"; }
                    else if(allHostsFile.match(/\r/)) { LINE_SEPARATOR = "\r"; }
                    allHosts = allHostsFile.split(LINE_SEPARATOR);
                    console.log("Read " + allHosts.length + " hosts from command line");
                    while (allHosts.length >= 1) {
                        var newArray = [];
                        allHosts.splice(0, 500).forEach(function (host) {
                            //console.log({address: host.split(":")[0], port: host.split(":")[1]})
                            newArray.push({address: host.split(":")[0], port: host.split(":")[1]});
                        });
                        console.log("Added " + newArray.length + " hosts to be queued.");
                        pingHostsArrays.push(newArray);
                    }
                } else {
                    console.log("No hosts specified");
                    process.exit(1);
                }
                var total_sent = 0;
                if (pingHostsArrays.length > 0) {
                    console.log("Sending " + pingHostsArrays.length + " jobs to queue");
                    pingHostsArrays.forEach(function (pingHostsArray) {
                        ch.sendToQueue(queue, new Buffer.from(JSON.stringify({ task: "multi-ping", servers: pingHostsArray })), {}, function (err, ok) {
                            if (err) { return console.log("Failed to send ping request for " + pingHostsArray.length + " to queue: " + queue); }
                            console.log("Sent ping request for " + pingHostsArray.length + " to queue: " + queue);
                            total_sent = total_sent+pingHostsArray.length;
                        });
                    });
   //                 console.log("Finished sending " + total_sent + " hosts to queue: " + queue);
   //                 process.exit(0);
                } else {
                    console.log("No hosts to ping");
                    process.exit(0);
                }
                break;
            default:
                console.log("Unknown command: " + App.args['command']);
                process.exit(0);
                break;
        }
    });
});