var App = {};
var status = require('minecraft-status').MinecraftServerListPing;
//var geolite2 = require('geolite2');
var maxmind = require('maxmind');
var fs = require('fs');
var Reader = maxmind.Reader;
var modpacksByFavicon = {};
const Discord = require('discord.js');

var since_last_log = 0;

const webhookClient = new Discord.WebhookClient({ url: "https://discord.com/api/webhooks/1249899934573137993/SxFJvc_i02LqxFFEavJnjP3LRqm8M-aOSGL2w5xWH4L0qETEnE4fYEo8K3K5rD4iFwz8" });

App.announceServerUpdate = function (Server) {
    if (!webhookClient) { return; }
    if(Server.players_online < 5) { return; }
    try {
        var embed = new Discord.EmbedBuilder()
            .setTitle("Server Update")
            .setDescription("Server " + Server.address + ":" + Server.port + " has been updated.")
            .addFields([
                { name: "Players Online", value: Server.players_online + "/" + Server.players_limit, inline: true },
                { name: "Version", value: Server.version, inline: true },
                { name: "Location", value: Server.city + ", " + Server.country + " ("+ Server.region +")", inline: true },
                { name: "ASN Number", value: "AS"+Server.asn_number, inline: true },
                { name: "ASN Name", value: Server.asn_name, inline: true },
                { name: "MOTD", value: Server.motd}
            ]).setColor(0x00FF00)
            .setFooter({ text: Server.address + ":" + Server.port, icon_url: "https://api.mcsrvstat.us/icon/" + Server.address + "/" + Server.port});
        webhookClient.send({ embeds: [embed], username: Server.address + ":" + Server.port, avatarURL: "https://api.mcsrvstat.us/icon/" + Server.address + "/" + Server.port });
        console.log("[DISCORD-WEBHOOK][ANNOUNCED][" + Server.country_code + "/" + Server.region + "][" + Server.players_online + "/" + Server.players_limit + "] " + Server.address + ":" + Server.port + " - " + Server.version);
    } catch(e) {
        console.log("Failed to announce server update for " + Server.address + ":" + Server.port + " to Discord");
        console.log(e);
    
    }

}

require('./modpacks.json').forEach(function(modpack){
    modpacksByFavicon[modpack.favicon] = modpack;
});

var geolite2_city = __dirname + '/GeoLite2-City.mmdb';
var geolite2_asn = __dirname + '/GeoLite2-ASN.mmdb';

console.log("Reading database from file.");
var lookup = new Reader(fs.readFileSync(geolite2_city));
var asnLookup = new Reader(fs.readFileSync(geolite2_asn));

App.config = {
    mysql: {
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'pinger',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'pinger',
        port: process.env.MYSQL_PORT || 3306
    },
    message_queue: {
        queue_name: process.env.QUEUE_NAME || 'jobs',
        queue_host: process.env.QUEUE_HOST || 'localhost',
        queue_username: process.env.QUEUE_USERNAME || 'guest',
        queue_password: process.env.QUEUE_PASSWORD || 'guest'
    },
    debug: false
};
const amqplib = require('amqplib/callback_api');
const mysql = require('mysql');

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
            debug: process.env.SQL_DEBUG||false,
            verbose: process.env.SQL_DEBUG||false
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
        debug: process.env.SQL_DEBUG||false
    });
    return mysqlPool;
}

var queue = App.config.message_queue.queue_name;

App.getMySQLPool().query("ALTER TABLE `servers` ADD column `detected_mod_pack` varchar(128), ADD column `detected_mod_pack_short` varchar(16)", [], function (err, result) {
    if (err) {
        if(App.config.verbose) {
            return console.log("Error updating server table: " + err);
        }
    }
    if(App.config.verbose) {
        console.log("Updated server table");
    }
});


if(App.config.verbose) {
    console.log("Attempting connection to RabbitMQ server at " + App.config.message_queue.queue_host);
    console.log("Username:\t" + App.config.message_queue.queue_username);
    console.log("Queue:\t\t" + App.config.message_queue.queue_name);
}
amqplib.connect('amqp://' + App.config.message_queue.queue_username + ":" + App.config.message_queue.queue_password + "@" + App.config.message_queue.queue_host + "/dev", {}, function (err, conn) {
    var running_jobs = 0;
    if(App.config.verbose) {
        console.log("Connected to " + App.config.message_queue.queue_host);
    }
    conn.createChannel(function (err, ch) {
        ch.prefetch(4);
        ch.on('error', console.log);
        /*ch.on('close', console.log);
        ch.on('drain', console.log);
        ch.on('return', console.log);*/

        if (err) {
            console.log(err);
            return;
        }
        console.log('Connecting to queue: ' + queue);
        ch.consume(queue, function (message) {
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
                    // case 'ping':
                    //     try {
                    //         if(running_jobs < 0) { console.log("Running jobs: " + running_jobs); return process.exit(1); }
                    //         if(running_jobs >= 8)
                    //         {
                    //             ch.nack(message, true, true);
                    //             //ch.prefetch(0);
                    //             return;
                    //         }
                    //         ch.ack(message);
                    //         running_jobs++;
                    //         //ch.prefetch(8-running_jobs);
                    //     } catch (e) {
                    //         if(App.config.debug) {
                    //             console.log(e);
                    //         }
                    //         return;
                    //     }
                    //     if(App.config.debug) {
                    //         console.log("Pinging " + msg_data.server + ":" + msg_data.port);
                    //     }
                    //     var detected_modpack = null;
                    //     var detected_modpack_short = null;
                    //     status.fullQuery(msg_data.server, msg_data.port, (process.env.PING_TTL||15) * 1000)
                    //         .then(response => {
                    //             running_jobs--;
                    //             //ch.prefetch(8-running_jobs);
                    //             var city = null;
                    //             var country = null;
                    //             var country_code = null;
                    //             var continent = null;
                            
                    //             var location = lookup.get(msg_data.server) || {};
                    //             var asnInfo = asnLookup.get(msg_data.server) || {};
                    //             if(location) {
                    //                 try {
                    //                     city = location.city.en || null;
                    //                 } catch (e) { city = null; }
                    //                 country = location.registered_country.names.en || null;
                    //                 country_code = location.registered_country.iso_code || null;
                    //                 continent = location.continent.code || null;
                    //             }
                    //             if(response.favicon && modpacksByFavicon[favicon]) {
                    //                detected_modpack = modpacksByFavicon[favicon].name;
                    //             }
                    //             var players = [];
                    //             if(response.players.sample && response.players.sample.length > 0) {
                    //                 response.players.sample.forEach(function (player) {
                    //                     if(player.name) {
                    //                         players.push((player.id||'NO-ID') + "/" + player.name);
                    //                     } else {
                    //                         players.push(player);
                    //                     }
                    //                 });
                    //             }
                    //             App.announceServerUpdate({
                    //                 address: msg_data.server,
                    //                 port: msg_data.port,
                    //                 motd: response.description.text,
                    //                 version: response.version.name,
                    //                 players_online: response.players.online,
                    //                 players_limit: response.players.max,
                    //                 player_names: players.join(","),
                    //                 plugins: ((response.server_modification).plugins).join(";")||null,
                    //                 last_ping: new Date(),
                    //                 city: city,
                    //                 country: country,
                    //                 country_code: country_code,
                    //                 region: continent,
                    //                 asn_number: asnInfo.autonomous_system_number||null,
                    //                 asn_name: asnInfo.autonomous_system_organization||null,
                    //                 detected_mod_pack: detected_modpack,
                    //                 detected_mod_pack_short: detected_modpack_short
                    //             })

                    //             App.getMySQLPool().query("REPLACE INTO servers (address, port, motd, version, players_online, players_limit, player_names, plugins, last_ping,`city`,`country`, `country_code`,`region`,asn_number,asn_name,detected_mod_pack,detected_mod_pack_short) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)", [msg_data.server, msg_data.port, response.description.text, response.version.name, response.players.online, response.players.max, players.join(","), ((response.server_modification).plugins).join(";")||null, city, country, country_code, continent, asnInfo.autonomous_system_number||null, asnInfo.autonomous_system_organization||null], function (err, result) {
                    //                 if (err) {
                    //                     if(App.config.debug) {
                    //                         console.log("Error updating server status: " + err);
                    //                     }
                    //                 } else {
                    //                     if(App.config.verbose) {
                    //                         console.log("Updated server status for " + msg_data.server + ":" + msg_data.port);
                    //                     }
                    //                 }
                    //             });
                    //         }).catch(error => {
                    //             running_jobs--;
                    //             //ch.prefetch(8-running_jobs);
                    //             if(App.config.debug) {
                    //                 console.log("Minecraft Status Ping request to " + msg_data.server + ":" + msg_data.port + " failed");
                    //             }
                    //         });
                    //     break;
                    case 'ping':
                        /*
                         * Code above has been deprecated.
                         * This should work as a wrapper for the multi-ping task.
                        */
                        msg_data.servers = [{address: msg_data.server, port: msg_data.port}];
                        delete msg_data.server;
                        delete msg_data.port;
                    case 'multi-ping':
                        try {
                            if(running_jobs >= 16)
                            {
                                ch.nack(message, true, true);
                                return;
                            }
                            ch.ack(message);
                            running_jobs++;
                        } catch (e) {
                            if(App.config.debug) {
                                console.log(e);
                            }
                            return;
                        }
                        if(App.config.verbose) {
                            console.log("Pinging " + msg_data.servers.length + " servers");
                        }
                        var servers = msg_data.servers;
                        var i = 0;
                        var uc = 0;
                        function checkServer(index) {
                            if (index >= servers.length || !servers[index]) {
                                if(App.config.verbose) {
                                    console.log("Finished pinging " + servers.length + " servers and updated " + uc + " of them.");
                                }
                                return;
                            }
                            since_last_log++;
                            status.ping(767, servers[index].address, servers[index].port, 3000)
                                .then(response => {
                                    var city = null;
                                    var country = null;
                                    var country_code = null;
                                    var continent = null;
                                
                                    var location = lookup.get(servers[index].address);
                                    var asnInfo = asnLookup.get(servers[index].address);
                                    if(location) {
                                        try {
                                            city = location.city.en || null;
                                        } catch (e) { city = null; }
                                        country = location.registered_country.names.en || null;
                                        country_code = location.registered_country.iso_code || null;
                                        continent = location.continent.code || null;
                                    }
                                    var QueryString;
                                    var Params = [];
                                    if(servers[index].sid) {
                                        QueryString = "UPDATE servers SET";
                                        var QueryParams = [];
                                        if((response.description||{}).text) { QueryParams.push("motd = ?"); Params.push(response.description.text.substring(0,2000)); }
                                        if((response.version||{}).name) { QueryParams.push("version = ?"); Params.push(response.version.name.substring(0,96)); }
                                        QueryParams.push("players_online = ?");
                                        Params.push((response.players||{}).online||0);
                                        QueryParams.push("players_limit = ?");
                                        Params.push((response.players||{}).max||0);
                                        
                                        var playersTmp = [];
                                        var players;
                                        if(response.players.sample && response.players.sample.length > 0) {
                                            response.players.sample.forEach(function (player) {
                                                if(player.name) {
                                                    playersTmp.push((player.id||'NO-ID') + "/" + player.name);
                                                } else {
                                                    playersTmp.push(player);
                                                }
                                            });
                                        }
                                        if(playersTmp.length > 0) {
                                            players = playersTmp.join(",");
                                        } else {
                                            players = null;
                                        }
                                        var PLUGINS = null;
                                        if(response.server_modification && response.server_modification.plugins) {
                                            PLUGINS = response.server_modification.plugins.join(";");
                                        }
                                        
                                        var detected_modpack = null;
                                        var detected_modpack_short = null;



                                        if(response.favicon) {
                                            if(response.favicon.length <= 8192) {
                                                QueryParams.push("favicon = ?");
                                                Params.push(response.favicon);
                                            }
                                            if(modpacksByFavicon[response.favicon]) {
                                                detected_modpack = modpacksByFavicon[response.favicon];
                                                QueryParmans.push("detected_mod_pack = ?");
                                                Params.push(detected_modpack.name);
                                                QueryParmans.push("detected_mod_pack_short = ?");
                                                Params.push(detected_modpack.short);
                                             }
                                        }
                                        
                                        QueryParams.push("player_names = ?");
                                        Params.push(players);
                                        QueryParams.push("plugins = ?");
                                        Params.push(((response.server_modification||{}).plugins||[]).join(";")||null);
                                        QueryParams.push("last_ping = NOW()");
                                        if(city) { QueryParams.push("city = ?"); Params.push(city); }
                                        if(country) { QueryParams.push("country = ?"); Params.push(country); }
                                        if(country_code) { QueryParams.push("country_code = ?"); Params.push(country_code); }
                                        if(continent) { QueryParams.push("region = ?"); Params.push(continent); }
                                        if(asnInfo.autonomous_system_number) { QueryParams.push("asn_number = ?"); Params.push(asnInfo.autonomous_system_number); }
                                        if(asnInfo.autonomous_system_organization) { QueryParams.push("asn_name = ?"); Params.push(asnInfo.autonomous_system_organization); }
                                        QueryString += " " + QueryParams.join(", ") + " WHERE sid = ?";
                                        Params.push(servers[index].sid);
                                    } else {
                                        var playersTmp = [];
                                        var players;
                                        if(response.players.sample && response.players.sample.length > 0) {
                                            response.players.sample.forEach(function (player) {
                                                if(player.name) {
                                                    playersTmp.push((player.id||'NO-ID') + "/" + player.name);
                                                } else {
                                                    playersTmp.push(player);
                                                }
                                            });
                                        }
                                        if(playersTmp.length > 0) {
                                            players = playersTmp.join(",");
                                        } else {
                                            players = null;
                                        }
                                        var PLUGINS = null;
                                        if(response.server_modification && response.server_modification.plugins) {
                                            PLUGINS = response.server_modification.plugins.join(";");
                                        }
                                        QueryString = "REPLACE INTO servers (address, port, motd, version, players_online, players_limit, player_names, plugins, last_ping,`city`,`country`, `country_code`,`region`,asn_number,asn_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?)";
                                        Params.push(servers[index].address, servers[index].port, response.description.text, response.version.name.substring(0,96), response.players.online, response.players.max, players, PLUGINS, city, country, country_code, continent, asnInfo.autonomous_system_number||null, asnInfo.autonomous_system_organization||null);
                                        /*
                                         * Send a webhook message to Discord with the server update.
                                         */
                                        console.log("[STATUS-REPLY]["+country+"]["+ asnInfo.autonomous_system_organization +" // AS" + asnInfo.autonomous_system_number + "] " + servers[index].address + ":" + servers[index].port + " - " + response.version.name.substring(0,76) + "; " + since_last_log + " pings since last find.");
                                        since_last_log = 0;

                                        App.announceServerUpdate({
                                            address: servers[index].address||"127.0.0.1",
                                            port: servers[index].port||1,
                                            motd: response.description.text||"None",
                                            version: response.version.name||"Unknown",
                                            players_online: response.players.online,
                                            players_limit: response.players.max,
                                            last_ping: new Date(),
                                            city: city||"Unknown",
                                            country: country||"Unknown",
                                            country_code: country_code||"Unknown",
                                            region: continent||"Unknown",
                                            asn_number: asnInfo.autonomous_system_number||"Unknown",
                                            asn_name: asnInfo.autonomous_system_organization||"Unknown"
                                        })

                                    }
                                    App.getMySQLPool().query(QueryString, Params, function (err, result) {
                                        if (err) {
                                            if(App.config.debug) {
                                                console.log("Error updating server status: " + err);
                                            }
                                        } else {
                                            uc++;
                                            if(App.config.verbose) {
                                                console.log("Updated server status for " + servers[index].address + ":" + servers[index].port);
                                            }
                                        }
                                    });
                                    checkServer(index + 1);
                                    running_jobs--;
                                    //ch.prefetch(8-running_jobs);
                                }).catch(error => {
                                    if(App.config.debug) {
                                        console.log("Minecraft Status Ping request to " + servers[index].address + ":" + servers[index].port + " failed");
                                        //console.log(error);
                                    }
                                    checkServer(index + 1);
                                    running_jobs--;
                                    //ch.prefetch(8-running_jobs);
                                });
                        }
                        checkServer(0);
                        break;
                    default:
                        //ch.reject(message);
                        //ch.nack(message, false, false);
                        console.log("Unknown task: " + msg_data.task);
                        break;
                }
            }
        });
    });
});