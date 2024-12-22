var app = {};
const mysql = require('mysql');
const fs = require('fs');
const { resourceLimits } = require('worker_threads');
const moment = require('moment');

const table = require('table').table;
console.table = function(data, headers) {
    console.log(table((headers||[]).concat(data)));
}

app.args = require('commandos').parse(process.argv);
app.pkg = require('../package.json');
app.config = {
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

var pool = mysql.createPool(app.config.mysql);
if (!pool) {
    console.log("Could not connect to MySQL server");
    return process.exit(1);
}
var FILE_NAME = app.args['file'];
var QUERY = app.args['query'];
var lines;
if (FILE_NAME) {

    try {
        console.log("Querying database from file: " + FILE_NAME);
        pool.query(fs.readFileSync(FILE_NAME, 'utf8').toString(), function(err, result) {
            if (err) {
                console.log(err);
                return process.exit(1);
            }
            console.log("Database query finished");
            return process.exit(0);
        });
    } catch(e) {
        console.log(e);
        return process.exit(1);
    }
} else if(QUERY) {
    try {
        console.log("Running Query on Server:\n\t\t" + QUERY);
        pool.query(QUERY, function(err, result, fields) {
            if (err) {
                console.log(err);
                return process.exit(1);
            }

            var viewRows = [];
            result.forEach(function(row) {
                var viewRow = [];
                fields.forEach(function(field) {
                    if(row[field.name] instanceof Date) {
                        viewRow.push(moment(row[field.name]).fromNow());
                    } else {
                        viewRow.push(row[field.name]);
                    }
                });
                viewRows.push(viewRow);
            });
            console.table(viewRows);
            return process.exit(0);
        });
    } catch(e) {
        console.log(e);
        return process.exit(1);
    }

} else {
    console.log('Please specify a file or query to send to the database.');
    process.exit(1);
}