const mysql = require('mysql');

function getCountries(getApp) {
    /*
     * QUERY PARMS:
     *  maxServers - the maximum number of servers running the same version to return.
     *  minServers - the minimum number of servers running the same version to return.
     * country - the version to return.  If not specified, all versions are returned. Accepts * as a wildcard.
     */
    return function(req,res) {
        var query = "SELECT count(*) as num_servers, country,country_code FROM servers WHERE 1=1";
        var params = [];
        if (req.query.version) {
            query += " AND version like ?";
            params.push(req.query.country.replaceAll("*", "%"));
        }
        query += " AND last_ping > DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY country ORDER BY num_servers DESC";
        getApp().getMySQLPool().query(query, params, function(err, rows, fields) {
            if (err) {
                return res.status(500).json({error: err});
            };
            return res.status(200).json({unique_countries: rows.length, countries: rows});
        });
    };
}

exports.load = function(getApp) {
    var app = getApp();
    app.get("/api/v0.1/servers/countries", getCountries(getApp));
}