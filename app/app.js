const express = require('express');
var app = express();
const mysql = require('mysql');
const fs = require('fs');
var libs = {};
var mqChan = null;

app.pkg = require('./package.json');
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
    },
    message_queue: {
        queue_name: process.env.QUEUE_NAME || 'jobs',
        queue_host: process.env.QUEUE_HOST || 'localhost',
        queue_username: process.env.QUEUE_USERNAME || 'guest',
        queue_password: process.env.QUEUE_PASSWORD || 'guest'
    }
};

var mysqlPool;
const amqplib = require('amqplib/callback_api');

app.getMQChannel = function(cb) {
    if(mqChan) { return cb(mqChan); }
    console.log("Attempting connection to RabbitMQ server at " + app.config.message_queue.queue_host);
    console.log("Username:\t" + app.config.message_queue.queue_username);
    console.log("Queue:\t\t" + app.config.message_queue.queue_name);
    amqplib.connect('amqp://' + app.config.message_queue.queue_username + ":" + app.config.message_queue.queue_password + "@" + app.config.message_queue.queue_host + "/dev", {}, function (err, conn) {
        if(err) { console.log(err); return cb(null); }
        console.log("Connected to " + app.config.message_queue.queue_host);
        conn.createChannel(function (err, ch) {
            if(err) { return cb(null); }
            if(ch) {
                mqChan = ch;
                return cb(mqChan);
            } else { return cb(null); }
        });
    });
};


app.getMySQLPool = function() {
    if(mysqlPool) { return mysqlPool; }
    else {
        mysqlPool = mysql.createPool({
            connectionLimit : app.config.mysql.connectionLimit, //important
            host     : app.config.mysql.host,
            port     : app.config.mysql.port,
            user     : app.config.mysql.user,
            password : app.config.mysql.password,
            database : app.config.mysql.database,
            debug    :  false
        });
        return mysqlPool;
    }
}

app.getRootMySQLPool = function() {
    if(mysqlPool && mysqlPool.user && mysqlPool.user != 'root') { mysqlPool = null; }
    else if(mysqlPool && mysqlPool.user && mysqlPool.user.toString() == 'root' ) { return mysqlPool; }
    mysqlPool = mysql.createPool({
        connectionLimit : app.config.mysql.connectionLimit, //important
        host     : app.config.mysql.host,
        port     : app.config.mysql.port,
        user     : 'root',
        password : app.config.mysql.root_password,
        debug    :  false
    });
    return mysqlPool;
}

function checkDB(cb) {
    app.getMySQLPool().query("SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = 'app'", function(err1, rows, fields) {
        if(err1 || rows.length == 0) {
            console.log(err1);
            app.getRootMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/schema.sql").toString(), function(err2, rows, fields) {
                if(err2) {
                    console.log("Error creating DB: " + err2);
                    return process.exit(0);
                    //return cb(false);
                }
                console.log("DB created.. Exiting process..");
                return process.exit(1);
                //return cb(true);
            });
        }
        return cb(true);
    });
}

function checkConfTable() {
    app.getMySQLPool().query("SELECT * FROM configuration WHERE `config_var` = 'db_version'", (err, rows) => {
        if(err && err.errno == 1146) {
            console.log("Table configuration does not exist..");
            app.getMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/tables/configuration.sql").toString(), function(err2, rows, fields) {
                if(err2) {
                    console.log("Error creating configuration table: " + err2);
                    return process.exit(0);
                }
                console.log("Table configuration created..");
                return checkConfTable();
            });
            return;
        } else if(err) {
            console.error(err);
            return;
        }
        if(rows.length == 0 || !rows[0] || !!rows[0].config_value) {
            app.getMySQLPool().query("INSERT INTO `configuration` (`config_var`, `config_val`) VALUES ('db_version', '0.1');", (err3, rows) => {
                if(err3) {
                    console.error(err3);
                    return;
                }
                console.log("DB version set to 0.1");
                return checkConfTable();
            });
        }
        console.log("Deployed with database version:\t" + rows[0].config_val);
        checkServersTable();
    });
}

checkServersTable = function() {
    app.getMySQLPool().query("SELECT * FROM servers", (err, rows, fields) => {
        if(err && err.errno == 1146) {
            console.log("Table servers does not exist..");
            app.getMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/tables/servers.sql").toString(), function(err2, rows) {
                if(err2) {
                    console.log("Error creating servers table: " + err2);
                    return process.exit(0);
                }
                console.log("Table servers created..");
                return checkServersTable();
            });
            return;
        } else if(err) {
            console.error(err);
            return;
        }

        var found_field = false;
        var i = 0;
        while(i < fields.length && !found_field) {
            if(fields[i].name == 'last_ping') { found_field = true; }
            i++;
        }
        if(!found_field) {
            console.log("Column last_ping does not exist..");
            app.getMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/tables/servers_r2.sql").toString(), function(err4, rows3, fields) {
                if(err4) {
                    console.log("Error updating servers table to revision 2: " + err4);
                    return process.exit(0);
                }
                console.log("Table altered..");
                return checkServersTable();
            });
        }
        var found_field2 = false;
        var i2 = 0;
        while(i2 < fields.length && !found_field2) {
            if((fields[i2]||{}).name == 'asn_name') { found_field2 = true; }
            i2++;
        }
        if(!found_field2) {
            console.log("Column asn_name does not exist..");
            app.getMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/tables/servers_r3.sql").toString(), function(err4, rows3, fields) {
                if(err4) {
                    console.log("Error updating servers table to revision 3: " + err4);
                    return process.exit(0);
                }
                console.log("Table altered..");
                return checkServersTable();
            });
        }
        var found_field_offline_mode = false;
        for(var count = 0; count < fields.length; count++) {
            if(fields[count].name == 'offline_mode') {
                found_field_offline_mode = true;
            }
        }
        if(!found_field_offline_mode) {
            console.log("Column offline_mode does not exist..");
            app.getMySQLPool().query(fs.readFileSync(process.cwd().toString() + "/lib/sql/v0/tables/servers_r5.sql").toString(), function(err4, rows3, fields) {
                if(err4) {
                    console.log("Error updating servers table to revision 5: " + err4);
                    return process.exit(0);
                }
                console.log("Table altered..");
                return checkServersTable();
            });
        }
        console.log("There are " + rows.length + " servers in the database.");
    });
}

try {
    checkDB(function(success) {
        if(success) {
            checkConfTable();
        }
    });
} catch (err) {
    console.error(err);
}

app.use(function(req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json = function(data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
    };
    next();
});
app.get("/", (req, res) => {
    return res.json({
        name: app.pkg.name,
        version: app.pkg.version,
        description: app.pkg.description
    });
});

libs['Servers/Find'] = require('./lib/servers/find').load(function() { return app; });
libs['Servers/Versions'] = require('./lib/servers/versions').load(function() { return app; });
libs['Servers/Countries'] = require('./lib/servers/country').load(function() { return app; });
libs['Servers/UpdateScheduler'] = require('./lib/servers/update-scheduler').load(function() { return app; });
libs['Servers/Region'] = require('./lib/servers/region').load(function() { return app; });
libs['Status/Ping'] = require('./lib/status/ping').load(function() { return app; });

app.listen(app.config.port, () => {
  console.log("API Server listening on port " + app.config.port);
});