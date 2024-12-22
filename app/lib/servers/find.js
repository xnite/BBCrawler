const mysql = require('mysql');
const moment = require('moment');

function findServers(getApp) {
    return function (req, res) {
        var version = (req.query.version||'*').replaceAll("*", "%");
        var minUsers = req.query.minUsers;
        var maxUsers = req.query.maxUsers;
        var minAge = req.query.minAge;
        var maxAge = req.query.maxAge;
        var sort = req.query.sort;
        var order = req.query.order;
        var page = parseInt(req.query.page||1);
        var limit = parseInt(req.query.limit||50);
        var region = req.query.region;
        var country = req.query.country;
        var country_code = req.query.country_code;
        var noFilter = req.query.noFilter||false;
        var motd = (req.query.motd||null);
        var city = (req.query.city||null);
        var showFavicon = req.query.favicon||false;
        var relativeTime = req.query.relativeTime||false;
        var modpack = req.query.modpack||null;
        if(city && city != null) {
            if(!city.startsWith("*")) {
                city = "*"+city;
            }
            if(!city.endsWith("*")) {
                city += "*";
            }
        }
        if(motd && motd != null) {
            if(!motd.startsWith("*")) { motd = "*"+motd; }
            if(!motd.endsWith("*")) { motd += "*"; }
        }
        var asn_name = req.query.org||null;
        var asn_number = req.query.asn||null;
        if(asn_name && asn_name != null) {
            if(!asn_name.startsWith("*")) { asn_name = "*"+asn_name; }
            if(!asn_name.endsWith("*")) { asn_name += "*"; }
        }
        var query = ["SELECT * FROM servers WHERE public = 1"];
        var count_query = ["SELECT COUNT(*) AS total_results FROM servers WHERE public = 1"];
        var count_filtered_query;
        if(!noFilter) {
            count_filtered_query = "SELECT COUNT(*) AS total_results FROM servers WHERE public = 1 AND version like '%TCPShield%'";
        }
        var params = [];
        if(typeof page != 'number' || page <= 0 ) { page = 1; }
        if(typeof limit != 'number' || limit > 500 || limit < 1) { limit = 50; }
        if(!noFilter) {
            query.push("AND version NOT LIKE '%TCPShield.com%'");
        }
        if(version) {
            query.push("AND version like ?");
            count_query.push("AND version like ?");
            if(!noFilter) { count_filtered_query += " AND version like ?"; }
            params.push(version);
        }
        if(minUsers) {
            query.push("AND players_online >= ?");
            count_query.push("AND players_online >= ?");
            if(!noFilter) { count_filtered_query += " AND players_online >= ?"; }
            params.push(minUsers);
        }
        if(maxUsers) {
            query.push("AND players_online <= ?");
            count_query.push("AND players_online <= ?");
            if(!noFilter) { count_filtered_query += " AND players_online <= ?"; }
            params.push(maxUsers);
        }
        if(region) {
            query.push("AND region = ?");
            count_query.push("AND region = ?");
            if(!noFilter) { count_filtered_query += " AND region = ?"; }
            params.push(region);
        }
        if(country) {
            if(country.length == 2) {
                country_code = country;
                country = null;
            } else {
                query.push("AND country like ?");
                count_query.push("AND country like ?");
                if(!noFilter) { count_filtered_query += " AND country like ?"; }
                params.push(country.replaceAll("*", "%"));
            }
        }
        if(country_code) {
            query.push("AND country_code = ?");
            count_query.push("AND country_code = ?");
            if(!noFilter) { count_filtered_query += " AND country_code = ?"; }
            params.push(country_code);
        }
        if(minAge) {
            query.push("AND last_ping <= DATE_SUB(NOW(), INTERVAL "+ parseInt(minAge) +" DAY)");
            count_query.push("AND last_ping <= DATE_SUB(NOW(), INTERVAL "+ parseInt(minAge) +" DAY)");
            if(!noFilter) { count_filtered_query += " AND last_ping <= DATE_SUB(NOW(), INTERVAL "+ parseInt(minAge) +" DAY)"; }
            //params.push(minAge);
        }
        if(modpack) {
            query.push("AND (detected_mod_pack_short = ? OR detected_mod_pack like ?)");
            count_query.push("AND (detected_mod_pack_short = ? OR detected_mod_pack like ?)");
            if(!noFilter) { count_filtered_query += " AND (detected_mod_pack_short = ? OR detected_mod_pack like ?)"; }
            params.push(modpack);
            params.push(modpack.replaceAll("*", "%"));
        }
        query.push("AND last_ping >= DATE_SUB(NOW(), INTERVAL " + parseInt(maxAge||30) + " DAY)");
        count_query.push("AND last_ping >= DATE_SUB(NOW(), INTERVAL " + parseInt(maxAge||30) + " DAY)");
        if(!noFilter) { count_filtered_query += " AND last_ping >= DATE_SUB(NOW(), INTERVAL " + parseInt(maxAge||30) + " DAY)"; }

        if(motd && motd != null) {
            query.push("AND motd like ?");
            count_query.push("AND motd like ?");
            if(!noFilter) { count_filtered_query += " AND motd like ?"; }
            params.push(motd.replaceAll("*", "%"));
        }
        if(city && city != null) {
            query.push("AND city like ?");
            count_query.push("AND city like ?");
            if(!noFilter) { count_filtered_query += " AND city like ?"; }
            params.push(city.replaceAll("*", "%"));
        }
        if(asn_name && asn_name != null) {
            query.push("AND asn_name like ?");
            count_query.push("AND asn_name like ?");
            if(!noFilter) { count_filtered_query += " AND asn_name like ?"; }
            params.push(asn_name.replaceAll("*", "%"));
        }
        if(asn_number && asn_number != null) {
            query.push("AND asn_number = ?");
            count_query.push("AND asn_number = ?");
            if(!noFilter) { count_filtered_query += " AND asn_number = ?"; }
            params.push(parseInt(asn_number));
        }
        var sortVarName = 'last_ping,players_online DESC';
        if(sort) {
            switch(sort) {
                case 'users':
                    sortVarName = 'players_online DESC';
                    break;
                case 'version':
                    sortVarName = 'version DESC';
                    break;
                /*
                case 'name':
                    sortVarName = 'name ASC';
                    break;
                */
                case 'address':
                    sortVarName = 'address ASC';
                    break;
                case 'port':
                    sortVarName = 'port ASC';
                    break;
                /*
                case 'added':
                    sortVarName = 'server_added DESC';
                    break;
                */
                case 'updated':
                    sortVarName = 'last_ping DESC';
                    break;
                
                default:
                    sortVarName = 'address ASC';
                    break;
            }
        }
        query.push("ORDER BY " + sortVarName);
        query.push("LIMIT " + (page-1)*limit + ", " + limit);
        try {
            getApp().getMySQLPool().query(query.join(" "), params, function(err, rows, fields) {
                if(err) { return res.status(500).json({ error: err }); }
                else {
                    getApp().getMySQLPool().query(count_query.join(" "), params, function(count_err, count_rows, count_fields) {

                        if(count_err || !count_rows || count_rows.length < 1) 
                        {
                            return res.status(200).json({displayed: rows.length, results: rows});
                        }
                        rows.forEach(function(row, row_index) {
                            if(!showFavicon) {
                                delete row.favicon;
                            }
                            if(row.motd && row.motd != null) {
                                row.motd = row.motd.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                                row.motd_stripped = row.motd.replace(/§./g, "");
                            } else {
                                row.motd_stripped = null;
                            }
                            if(relativeTime) {
                                row.last_ping = moment(row.last_ping).fromNow();
                            }
                            if(row.player_names && row.player_names != null) {
                                row.players = [];
                                row.player_names.split(",").forEach(function(thePlayer){
                                    var player_name = thePlayer.split("/")[1];
                                    var player_uuid = thePlayer.split("/")[0];
                                    if(!player_uuid.match(/^00000000\-0000\-0000\-0000\-00000000[0-9][0-9][0-9][0-9]$/i))
                                    {
                                        row.players.push({uuid: player_uuid, name: player_name});
                                    }
                                });
                            } else {
                                row.players = [];
                            }
                            if(row.plugins && row.plugins != null) {
                                row.plugins = row.plugins.split(",");
                            } else {
                                row.plugins = [];
                            }
                            delete row.player_names;
                            delete row.sid;
                            rows[row_index] = row;
                        });
                        if(!noFilter) {
                            getApp().getMySQLPool().query(count_filtered_query, params, function(count_filtered_err, count_filtered_rows, count_filtered_fields) {
                                if(count_filtered_err || !count_filtered_rows || count_filtered_rows.length < 1) 
                                {
                                    return res.status(200).json({displayed: rows.length, results: rows});
                                }
                                return res.status(200).json({displayed: rows.length, total: count_rows[0].total_results, filtered: count_filtered_rows[0].total_results, results: rows});
                            });
                        } else {
                            return res.status(200).json({displayed: rows.length, total: count_rows[0].total_results, results: rows});
                        }
                    });
                }
            });
        } catch(err) {
            return res.status(500).json({ error: err });
        }
    }
}

exports.load = function(getApp) {
    var app = getApp();
    app.get("/api/v0.1/servers/find", findServers(getApp));
}