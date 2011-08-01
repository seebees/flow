var assert          = require('assert'),
    http            = require('http'),
    util            = require('util'),
    vows            = require('vows'),
    flow            = require('flow'),
    help            = require('./help.js')
    webServer       = help.webServer,
    returnData      = help.returnData,
    redirectServer  = help.redirectServer;

vows.describe('What the client sees').addBatch(
{
    'A basic get' : {
        topic : function () {
            return flow.get(webServer(returnData('asdf')) + '/asdf').
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will return data and the response.' : function(error, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A get without a path' : {
        topic : function () {
            return flow.get(webServer(returnData('asdf'))).
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will return data and the response.' : function(error, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic put' : {
        topic : function () {
            return flow.put(webServer(returnData('asdf')) + '/asdf').
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will return data and the response.' : function(error, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic post' : {
        topic : function () {
            return flow.post(webServer(returnData('asdf')) + '/asdf').
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will return data and the response.' : function(error, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A basic del' : {
        topic : function () {
            return flow.del(webServer(returnData('asdf')) + '/asdf').
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will return data and the response.' : function(error, data, response) {
            assert.strictEqual(data, 'asdf');
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser JSON' : {
        topic : function () {
            return flow.get(webServer(returnData(
                        '{ "ok": true }',{'Content-Type':'application/json'}))
                    ).
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will parse the JSON and return the object and response' : function(error, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser XML' : {
        topic : function () {
            return flow.get(webServer(returnData(
                            '<document><ok>true</ok></document>',{'Content-Type':'application/xml'}))
                    ).
                    end().on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will parse the XML and return the object and response' : function(error, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'Giveing the auto parser YALM' : {
        topic : function () {
                return flow.get(webServer(returnData(
                            'ok: true',{'Content-Type':'application/yaml'}))
                    ).
                    end().
                    on('end', function (data, response) {
                        this.emit('success', data, response);
                    });
        },
        'will parse the YALM and return the object and response' : function(error, data, response) {
            assert.ok(typeof data === 'object');
            assert.ok('ok' in data);
            assert.ok(data.ok);
            assert.ok(response instanceof http.IncomingMessage);
        }
    },
    'A redirect' : {
        topic : function () {
            return flow.get(redirectServer([])).
                    end().
                    on('end', function (data) {
                        this.emit('success', data);
                    });
        },
        'will be followed' : function(error, data, response) {
            assert.strictEqual(data, 'Hell Yeah!');
        }
    },
    'A recursive set of redirects' : {
        topic : function () {
            return flow.get(redirectServer(['/areYouMyMommy','/thenSomeWhereElse','/what'])).
                    end().
                    on('end', function (data) {
                        this.emit('success', data);
                    });
        },
        'will be followed to the end' : function(error, data, response) {
            assert.strictEqual(data, 'Hell Yeah!');
        }
    }
    //TODO test for events 200-500
}).export(module);
