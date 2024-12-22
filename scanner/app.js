var App = {};
const { exec } = require('child_process');

App.config = {
    message_queue: {
        queue_name: process.env.SCAN_QUEUE_NAME || 'jobs',
        queue_host: process.env.QUEUE_HOST || 'localhost',
        queue_username: process.env.QUEUE_USERNAME || 'guest',
        queue_password: process.env.QUEUE_PASSWORD || 'guest'
    },
    debug: process.env.DEBUG || false
};
var scan_hosts_queue = [];
var concurrent_scans = 0;
var SCAN_OPTS_CONCURRENT_SCANS = process.env.CONCURRENT_SCANS || 1;
const amqplib = require('amqplib/callback_api');

var Scanner = require('evilscan');
var fs = require('fs');
process.params = (require('commandos')).parse(process.argv);

function scan(opts, callback) {
    if(!opts) { opts = {}; }
    if(!callback) { callback = function(){}; }

    var MINECRAFT_DEFAULT_PORT = '25565-25566';
    var SCAN_OPTS_HOSTS = (opts.range||'1.2.0.0/16').toString();
    var SCAN_OPTS_PORTS = (opts.ports || MINECRAFT_DEFAULT_PORT).toString();
    
    var SCAN_OPTS_CONCURRENCY = process.env.CONCURRENT_CONNECTIONS || 1000;
    exec('masscan --wait 1 --rate ' + SCAN_OPTS_CONCURRENCY + ' -oL ./' + SCAN_OPTS_HOSTS.replace(/\./g, '-').replace(/\//g, '_') + "_" + SCAN_OPTS_PORTS + ".tmp -p " +SCAN_OPTS_PORTS+" " + SCAN_OPTS_HOSTS, (err, stdout, stderr) => {
        if (err) {
            return callback(err, null);
        }
        if(fs.existsSync('./' + SCAN_OPTS_HOSTS.replace(/\./g, '-').replace(/\//g, '_') + "_" + SCAN_OPTS_PORTS + ".tmp") == false) {
            return callback({"error":"Masscan failed."}, null);
        }
        fs.readFile('./' + SCAN_OPTS_HOSTS.replace(/\./g, '-').replace(/\//g, '_') + "_" + SCAN_OPTS_PORTS + ".tmp", 'utf8', function(err, data) {
            if(err) {
                return callback(err, null);
            }
            var lines = data.split('\n');
            var hosts = [];
            for(var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if(line.startsWith('#')) { continue; }
                // open tcp 25565 127.0.0.51 1719084338
                var parts = line.match(/open tcp ([0-9]+) ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
                if(!parts) { continue; }
                var port = parts[1];
                var ip = parts[2];

                if(App.config.debug) {
                    console.log("[OPEN-PORT] " + ip + ":" + port);
                }

                if(ip && port) {
                    hosts.push({address:ip,port:port});
                }
            }
            return callback(null, hosts);
        });

      });
}

var queue = App.config.message_queue.queue_name;

if(App.config.verbose) {
    console.log("Attempting connection to RabbitMQ server at " + App.config.message_queue.queue_host);
    console.log("Username:\t" + App.config.message_queue.queue_username);
    console.log("Queue:\t\t" + App.config.message_queue.queue_name);
}
amqplib.connect('amqp://' + App.config.message_queue.queue_username + ":" + App.config.message_queue.queue_password + "@" + App.config.message_queue.queue_host + "/dev", {}, function (err, conn) {
    if(App.config.verbose) {
        console.log("Connected to " + App.config.message_queue.queue_host);
    }
    if(err) {
        console.log(err);
        return process.exit(1);
    }
    conn.createChannel(function (err, ch) {
        ch.on('error', (error) => {
            console.log("An error occurred in the message queue:\n" + error);
        });
        ch.on('close', () => {
            console.log("Connection to queue has been closed. The application will now exit so that it can be restarted.");
            process.exit(1);
        });

        if (err) {
            console.log(err);
            return;
        }
        console.log('Connecting to queue: ' + queue);

        ch.consume("range-scan-queue", function (message) {
            if (message !== null) {
                try {
                    msg_data = JSON.parse(message.content.toString());
                } catch (e) {
                    if(App.config.debug) {
                        console.log("Failed to parse message; Message ID: " + message.properties.messageId + "\nMessage Content:\n" + message.content.toString());
                    }
                    return;
                }
                if (!msg_data.task) {
                    if(App.config.debug) {
                        console.log("No task specified; Message ID: " + message.properties.messageId + "\nMessage Content:\n" + message.content.toString());
                    }
                    return;
                }
                switch (msg_data.task) {
                    case 'scan':
                        /* TODO:
                         * Add a check to see if the application is already performing a scan.
                         */
                        if(concurrent_scans >= SCAN_OPTS_CONCURRENT_SCANS) {
                            // Too many concurrent scans; delaying scan request.
                            try {
                                ch.nack(message, true, true);
                                // Also tell the message queue that we're not ready to receive more messages.
                                ch.prefetch(0);
                            } catch(e) {
                                if(App.config.debug) {
                                    console.log(e);
                                }
                            }
                            return;
                        }
                        try {
                            ch.ack(message);
                            concurrent_scans++;
                            ch.prefetch(SCAN_OPTS_CONCURRENT_SCANS-concurrent_scans);
                        } catch (e) {
                            if(App.config.debug) {
                                console.log(e);
                            }
                            return;
                        }
                        if(App.config.debug) {
                            console.log("[SCAN-BEGIN] " + msg_data.range + ":" + msg_data.ports);
                        }
                        var hosts_found = 0;
                        scan({ range: msg_data.range, ports: msg_data.ports }, function(err, scan_res) {
                            if(err) {
                                console.log(err);
                                concurrent_scans--;
                                ch.prefetch(SCAN_OPTS_CONCURRENT_SCANS-concurrent_scans);
                                return;
                            }
                            if(!scan_res || scan_res.length == 0) {
                                concurrent_scans--;
                                ch.prefetch(SCAN_OPTS_CONCURRENT_SCANS-concurrent_scans);
                                console.log("[SCAN-END] " + msg_data.range + ":" + msg_data.ports + " - Found " + hosts_found + " open ports. " + concurrent_scans + " scans are still in progress.");
                                return;
                            }
                            while(scan_res.length > 0) {
                                var newMessage = { task: "multi-ping", servers: scan_res.splice(0, 500), allow_requeue: msg_data.allow_requeue };
                                hosts_found += newMessage.servers.length;
                                try {
                                    ch.sendToQueue("range-scanners", new Buffer.from(JSON.stringify(newMessage)), {}, function (err, ok) {
                                        if (err) { console.log(err); return; }
                                        console.log("Sent " + newMessage.servers.length + " hosts to the ping queue.");
                                    });
                                } catch (e) {
                                    console.log("Failed to send message to queue: " + "range-scanners");
                                    console.log(e);
                                }
                            }
                            concurrent_scans--;
                            ch.prefetch(SCAN_OPTS_CONCURRENT_SCANS-concurrent_scans);
                            console.log("[SCAN-END] " + msg_data.range + ":" + msg_data.ports + " - Found " + hosts_found + " open ports. " + concurrent_scans + " scans are still in progress.");
                            return
                        });
                        break;
                    case 'multi-scan':
                        try {
                            ch.ack(message);
                        } catch (e) {
                            if(App.config.debug) {
                                console.log(e);
                            }
                            return;
                        }

                        break;
                    default:
                        ch.reject(message);
                        console.log("Unknown task: " + msg_data.task);
                        break;
                }
            }
        });
    });
});