var http      = require('http'),
    util      = require('util');

var ports = [],
    addPort = function(){
        var p = Math.floor(Math.random()*10000+7000);
        if (ports.indexOf(p) > -1){
            return addPort();
        }
        ports.push(p);
        return p;
    };

exports.webServer = function (callback) {
    var port = addPort(),
        server = http.createServer(function(request, response) {
            if (typeof callback === 'function'){
                callback.call(this, request, response);
            }
            response.end();
            server.close();
            ports = ports.splice(
                ports.indexOf(port),
                1
            );
        });
    
    server.listen(port,'127.0.0.1');
    return 'http://127.0.0.1:' + port;
};

exports.returnData = function(data, headers, status){
    return function(request, response) {
        response.writeHead(status || 200, headers);
        response.write(data);
    };
};

exports.redirectServer =  function (paths) {
    var port = addPort(),
        lastPath = false,
        server = http.createServer(function (request, response) {
            if (!paths.length && request.url === lastPath) {
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                response.write('Hell Yeah!');
                response.end();
                server.close();
                ports = ports.splice(
                    ports.indexOf(port),
                    1
                );
              } else if (!lastPath || request.url === lastPath) {
                  lastPath = paths.length ? paths.shift() : '/redirected';
                  response.writeHead(301, { 
                      'Location': 'http://localhost:' + port + lastPath 
                  });
                  response.write('Redirecting...');
                  response.end();
              }
        });

    server.listen(port,'localhost');
    return 'http://localhost:' + port;
};