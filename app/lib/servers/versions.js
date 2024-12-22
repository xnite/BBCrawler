const mysql = require('mysql');

function getVersions(getApp) {
    /*
     * QUERY PARMS:
     *  maxServers - the maximum number of servers running the same version to return.
     *  minServers - the minimum number of servers running the same version to return.
     * version - the version to return.  If not specified, all versions are returned. Accepts * as a wildcard.
     */
    return function(req,res) {
        var query = "SELECT count(*) as num_servers, version FROM servers WHERE 1=1";
        var params = [];
        if (req.query.version) {
            query += " AND version like ?";
            params.push(req.query.version.replaceAll("*", "%"));
        }
        /*
        if(req.query.minServers) {
            query += " AND @servers_count >= ?";
            params.push(req.query.minServers);
        }
        if(req.query.maxServers) {
            query += " AND @servers_count <= ?";
            params.push(req.query.maxServers);
        }
        */
        query += " GROUP BY version ORDER BY num_servers DESC";
        if(req.query.limit && req.query.limit > 0 && req.query.limit < 1000) {
            query += " LIMIT " + parseInt(req.query.limit);
        }
        getApp().getMySQLPool().query(query, params, function(err, rows, fields) {
            if (err) {
                return res.status(500).json({error: err});
            };
            return res.status(200).json({unique_versions: rows.length, versions: rows});
        });
    };
}

exports.load = function(getApp) {
    var app = getApp();
    app.get("/api/v0.1/servers/versions", getVersions(getApp));
}