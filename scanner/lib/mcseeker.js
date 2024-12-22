var Scanner = require('evilscan');
var fs = require('fs');
process.params = (require('commandos')).parse(process.argv);

exports.scan = function(opts, callback) {
    if(!opts) { opts = {}; }
    if(!callback) { callback = function(){}; }

    var MINECRAFT_DEFAULT_PORT = '25565-25566';
    var SCAN_OPTS_HOSTS = (opts.range||'1.2.0.0/16').toString();
    var SCAN_OPTS_PORTS = (opts.ports || MINECRAFT_DEFAULT_PORT).toString();
    var SCAN_OPTS_CONCURRENCY = 500;

    console.log("Scanning ports " + SCAN_OPTS_PORTS + " on " + SCAN_OPTS_HOSTS + " with " + SCAN_OPTS_CONCURRENCY + " connections.");

    var options = {
        target: SCAN_OPTS_HOSTS,
        port: SCAN_OPTS_PORTS,
        states: 'O',
        banner: false,
        concurrency: SCAN_OPTS_CONCURRENCY
    }
    var pingList = [];
    var scan = new Scanner(options);

    scan.on('result', function(data){
        console.log("Found " + data.ip + ":" + data.port);
        callback(null, [{address:data.ip,port:data.port}]);
    })

    scan.on('error', err => {
        console.log(err.toString());
    });

    scan.on('done', () => {
        console.log("Scan finished!");
    });
    scan.run();
}