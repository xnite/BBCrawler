const mysql = require('mysql');

function getRegions(getApp) {
    /*
     * QUERY PARMS:
     *  maxServers - the maximum number of servers running the same version to return.
     *  minServers - the minimum number of servers running the same version to return.
     *  region - the continent to return.  If not specified, all continents are returned. Accepts * as a wildcard.
     */
    return function(req,res) {
        var query = "SELECT count(*) as num_servers, region FROM servers WHERE region IS NOT NULL AND last_ping > DATE_SUB(NOW(), INTERVAL 30 DAY)";
        var params = [];

        query += " AND region like ?";
        params.push((req.query.region||"*").replaceAll("*", "%"))

        query += " GROUP BY region ORDER BY region ASC";
        getApp().getMySQLPool().query(query, params, function(err, rows, fields) {
            if (err) {
                return res.status(500).json({error: err});
            };
            var total_servers = 0;
            rows.forEach(function(row) {
                total_servers += row.num_servers;
            });
            return res.status(200).json({unique_regions: rows.length, total_servers: total_servers, regions: rows});
        });
    };
}

exports.load = function(getApp) {
    var app = getApp();
    app.get("/api/v0.1/servers/regions", getRegions(getApp));
}