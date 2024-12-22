var app = {};
const mysql = require('mysql');
const fs = require('fs');
var libs = {};
var geolite2 = require('geolite2');
var maxmind = require('maxmind');

var Reader = maxmind.Reader;
app.args = require('commandos').parse(process.argv);
app.pkg = require('../package.json');
app.config = {
    port: (process.env.LISTEN_PORT|3000),
    ip: (process.env.LISTEN_ADDRESS|'0.0.0.0'),
    mysql: {
        host: (process.env.MYSQL_HOST||'localhost'),
        user: (process.env.MYSQL_USER||'root'),
        password: (process.env.MYSQL_PASSWORD||''),
        root_password: (process.env.MYSQL_ROOT_PASSWORD||''),
        database: (process.env.MYSQL_DATABASE||'test'),
        port: (process.env.MYSQL_PORT||3306),
        connectionLimit: (process.env.MYSQL_CONNECTION_LIMIT||100)
    }
};

var FILE_NAME = app.args['file'];
var LIMIT = app.args['limit'] || null;
var lines;

console.log("Reading database from file:" + geolite2.paths.city);
var lookup = new Reader(fs.readFileSync(geolite2.paths.city));
var pool = mysql.createPool(app.config.mysql);

function doImport(i) {
    if (i >= lines.length || !lines[i-1]) { 
        console.log("Finished");
        process.exit(1);
    }
    var line = lines[i-1];
    var values = [];
    var row;
    var ip;
    var port;
    var version;
    var players_online;
    var players_limit;
    var public = 1;
    var motd = null;
    if(app.args['private']) {
        public = '0';
    }
    var query = "INSERT INTO `servers` (`address`,`port`,`version`,`motd`,`players_online`,`players_limit`,`city`,`country`, `country_code`,`region`,`public`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    try {
        row = line.split(',');
        ip = row[0].split(':')[0];
        port = row[0].split(':')[1];
        version = row[1] || null;
        motd = row[3];
    } catch(e) {
        return;
    }
    try {
        players_online = row[2].split("/")[0];
        players_limit = row[2].split("/")[1];
    } catch(e) {
        players_online = 0;
        players_limit = 1;
    }
    var city = null;
    var country = null;
    var country_code = null;
    var continent = null;

    var location = lookup.get(ip);
    if(location) {
        city = location.city || null;
        country = location.registered_country.names.en || null;
        country_code = location.registered_country.iso_code || null;
        continent = location.continent.code || null;
    }
    values.push(ip, port, version, motd, players_online, players_limit, city, country, country_code, continent, public);
    return pool.query(query, values, function(err, result) {
        if(err) {
            switch(err.errno) {
                case 1062:
                    console.log("Duplicate entry: " + ip + ":" + port);
                    return doImport(i+1);
                case 1054:
                    console.log("Unknown column: " + err.sqlMessage);
                    return doImport(i+1);
                default:
                    console.log(err);
                    return doImport(i+1);
            }
            return doImport(i+1);
        }
        if(LIMIT && i >= LIMIT) {
            return false;
        }
        console.log("Added server " + ip + ":" + port + ", running version " + version);
        return doImport(i+1);
    });
}

fs.readFile(FILE_NAME, function(err, data) {
    if (err) {
        throw err;
    }
    lines = data.toString().split("\n");
    doImport(1);
});