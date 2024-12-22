const mysql = require('mysql');
function getPing(getApp) {
    function refresh(address, port) {
        if(port == undefined) {
            port = 25565;
        }
        getApp().getMQChannel((ch) => {
            if(!ch) {
                console.error("Error getting channel");
                return;
            }
            try {
                ch.sendToQueue("range-scanners", new Buffer.from(JSON.stringify({ task: "multi-ping", servers: [ { address: address, port: port } ] })), {}, (err, ok) => {
                    if (err) {
                        return console.log(err);
                    }
                });
                console.log("[STATUS-PING-REFRESH] " + address + ":" + port + " queued for refresh");
            } catch(e) {
                console.logg(e);
            }
        });
        return;
    }
    return function(req,res) {
        var query = "SELECT *,(last_ping <= DATE_SUB(NOW(), INTERVAL 30 MINUTE)) as needs_refresh FROM servers WHERE address=? AND port=? LIMIT 1";
        var params = [req.params.ip, req.params.port||25565];
        getApp().getMySQLPool().query(query, params, function(err, rows, fields) {
            if (err) {
                res.status(500).json({error: err});
                return refresh(req.params.ip, req.params.port);
            };
            if(rows.length == 0) {
                res.status(404).json({status: "Server not indexed. If thise server is online, it will be indexed shortly. Check back in a few minutes."});
                refresh(req.params.ip, req.params.port);
                return;
            } else if(rows[0].needs_refresh) {
                refresh(req.params.ip, req.params.port);
            }

            var needs_refresh = false;
            if(rows[0].needs_refresh) { needs_refresh = true; }
            var serverData = rows[0];
            delete serverData.needs_refresh;
            delete serverData.sid;
            delete serverData.public;
            delete serverData.plugins;
            delete serverData.player_names
            delete serverData.most_players;
            if(serverData.motd) {
                serverData.motd = serverData.motd.replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }

            var status = "online";
            if(needs_refresh) { status = "refreshing"; }
            return res.status(200).json({
                status: status,
                refresh: needs_refresh,
                server: serverData
            });
        });
    };
}

exports.load = function(getApp) {
    var app = getApp();
    app.get("/api/v0.1/status/ping/:ip/:port", getPing(getApp));
    app.get("/api/v0.1/status/ping/:ip\::port", getPing(getApp));
    app.get("/api/v0.1/status/ping/:ip", getPing(getApp));
}