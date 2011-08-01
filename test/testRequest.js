var assert          = require('assert'),
    http            = require('http'),
    util            = require('util'),
    vows            = require('vows'),
    flow            = require('flow'),
    Request         = flow.Request,
    help            = require('./help.js')
    webServer       = help.webServer,
    returnData      = help.returnData,
    redirectServer  = help.redirectServer;

vows.describe('What the client sees').addBatch(
{
    'new Request()' : {
        topic : function () {
            this.callback(null, new Request());
        },
        'will return a Request object with defaults.' : function(error, request) {
            assert.ok(request instanceof Request);
            assert.strictEqual(request.options.method, 'GET');
            assert.strictEqual(request.options.encoding, 'utf-8');
            assert.strictEqual(request.options.headers.accept, '*/*');
            assert.strictEqual(request.options.headers['user-agent'], 'flow for node.js');
        }
    },
    'new Request().uri(\'someURI\')' : {
        topic : function () {
            this.callback(null, 
                new Request().
                uri('http://asdf:qwer@www.google.com/new/place.php?value=BigDeal#1234')
            );
        },
        'will return a Request object with uri options set.' : function(error, request) {
            assert.strictEqual(request.options.protocol, 'http:');
            assert.strictEqual(request.options.basicAuth, 'asdf:qwer');
            assert.strictEqual(request.options.host, 'www.google.com');
            assert.strictEqual(request.options.port, 80);
            assert.strictEqual(request.options.path, '/new/place.php');
            assert.strictEqual(request.options.query, '?value=BigDeal');
            assert.strictEqual(request.options.hash, '#1234');
        },
        'and new Request(\'someURI\')' : {
            topic : function () {
                this.callback(null, 
                    new Request('http://asdf:qwer@www.google.com/new/place.php?value=BigDeal#1234')
                );
            },
            'are equivalant.' : function(error, request) {
                assert.strictEqual(request.options.protocol, 'http:');
                assert.strictEqual(request.options.basicAuth, 'asdf:qwer');
                assert.strictEqual(request.options.host, 'www.google.com');
                assert.strictEqual(request.options.port, 80);
                assert.strictEqual(request.options.path, '/new/place.php');
                assert.strictEqual(request.options.query, '?value=BigDeal');
                assert.strictEqual(request.options.hash, '#1234');
            }
        },
        'and new Request().protocol().basicAuth().host().port().path().query().hash()' : {
            topic : function() {
                this.callback(null,
                    new Request().
                        protocol('http:').
                        basicAuth('asdf:qwer').
                        host('www.google.com').
                        port(80).
                        path('/new/place.php').
                        query('value=BigDeal').
                        hash('#1234')
                );
            },
            'are equivalant.' : function (error, request) {
                assert.strictEqual(request.options.protocol, 'http:');
                assert.strictEqual(request.options.basicAuth, 'asdf:qwer');
                assert.strictEqual(request.options.host, 'www.google.com');
                assert.strictEqual(request.options.port, 80);
                assert.strictEqual(request.options.path, '/new/place.php');
                assert.strictEqual(request.options.query, '?value=BigDeal');
                assert.strictEqual(request.options.hash, '#1234');
            }
        }
    },
    'new Request(\'someURI\').query(\'string=value\').query({})' : {
        topic : function() {
            this.callback(null,
                new Request('http://asdf:qwer@www.google.com/new/place.php#1234').
                query('first=value').
                query({'even' : 'more'})
            );
        },
        'will append rationaly to request.options.query' : function (error, request) {
            assert.strictEqual(request.options.query, '?first=value&even=more');
        }
    },
    'new Request(\'someURI\').path(\'/deeper\').path(\'still/more\')' : {
        topic : function() {
            this.callback(null,
                new Request('http://asdf:qwer@www.google.com/new/place.php#1234').
                path('/deeper').
                path('still/more')
            );
        },
        'will append rationaly to request.options.query' : function (error, request) {
            assert.strictEqual(request.options.path, '/new/place.php/deeperstill/more');
        }
    },
    'new Request(\'someURI\').uri(\'relativeURI\')' : {
        topic : function () {
            this.callback(null,
                new Request('http://asdf:qwer@www.google.com/new/place.php?value=BigDeal#1234').
                uri('https://diff:rent@www.google.com/other/location.js?param=SmalDeal#4321')
            );
        },
        'will upate the URI' : function(error, request) {
            
            assert.strictEqual(request.options.protocol, 'https:');
            assert.equal(request.options.port, 443);
            assert.strictEqual(request.options.path, '/other/location.js');
            assert.strictEqual(request.options.query, '?param=SmalDeal');
            assert.strictEqual(request.options.hash, '#4321');
            
            //TODO fix bug in node.js with relative to https
            assert.strictEqual(request.options.host, 'www.google.com', 'I think this is a bug in node.');
            assert.strictEqual(request.options.basicAuth, 'diff:rent');
        }
    },
    'new Request().header(\'name\', \'value\')' : {
        topic : function () {
            this.callback(null,
                new Request('http://www.google.com').
                header('name', 'value')
            );
        },
        'will add the header to this.optiions.headers' : function (error, request) {
            assert.strictEqual(request.options.headers.name, 'value');
        },
        'Headers are case insensitive so updateing the same header with a different case' : {
            topic : function (request) {
                this.callback(null, request.header('NAME', 'other value'));
            },
            'will update the original header' : function (error, request) {
                assert.strictEqual(request.options.headers.name, 'other value');
            }
        },
        'after request() is called' : {
            topic : function (request) {
                request.request().header('Name', 'lastValue');
                this.callback(null, request);
            },
            'will update the underlying request' : function (error, request) {
                //TODO i think there is a but see flow.js:253
                assert.ok(false, 'see flow.js:253');
                //assert.strictEqual(request._request.getHeader('name'), 'lastValue');
            }
        }
    },
    'new Request().method(\'post\')' : {
        topic : function () {
            this.callback(null, new Request().method('post'));
        },
        'will update request.options.method to POST.' : function(error, request) {
            assert.strictEqual(request.options.method, 'POST');
        },
        'additional calls to request.method()' : {
            topic : function (request) {
                this.callback(null, request.method('put'));
            },
            'will update request.options.method' : function (error, request) {
                assert.strictEqual(request.options.method, 'PUT');
            }
        }
    },
    'new Request(path, {})' : {
        topic : function () {
            this.callback(null, new Request('', {
                protocol    : 'http:',
                basicAuth   : 'asdf:qwer',
                host        :'www.google.com',
                port        : 80,
                path        : '/new/place.php',
                query       : 'value=BigDeal',
                hash        : '#1234',
                method      : 'post'
            }));
        },
        'will apply all options to the Request object' : function (error, request) {
            assert.strictEqual(request.options.protocol, 'http:');
            assert.strictEqual(request.options.basicAuth, 'asdf:qwer');
            assert.strictEqual(request.options.host, 'www.google.com');
            assert.strictEqual(request.options.port, 80);
            assert.strictEqual(request.options.path, '/new/place.php');
            assert.strictEqual(request.options.query, '?value=BigDeal');
            assert.strictEqual(request.options.hash, '#1234');
            assert.strictEqual(request.options.method, 'POST');
        }
    },
    'new Request().form(data)' : {
        topic : function () {
            this.callback(null, new Request().form('query=value'));
        },
        'will set options.form' : function(error, request) {
            assert.strictEqual(request.options.form, 'query=value');
        },
        '.form(param2=value)' : {
            topic : function (request) {
                this.callback(null, request.form('param2=value'));
            },
            'will append the new value correctly' : function (error, request) {
                assert.strictEqual(request.options.form, 'query=value&param2=value');
            }
        }
    },
    'new Request().form({})' : {
        topic : function () {
            this.callback(null, new Request().form({
                'param1' : 'value1',
                'param2' : 'value2'
            }));
        },
        'will set options.form' : function (error, request) {
            assert.strictEqual(request.options.form, 'param1=value1&param2=value2');
        },
        '.form({})' : {
            topic : function (request) {
                this.callback(null, request.form({
                    'param3' : 'value3',
                    'param4' : 'value4'
                }));
            },
            'will append the new value correctly' : function (error, request) {
                assert.strictEqual(
                    request.options.form,
                    'param1=value1&param2=value2&param3=value3&param4=value4'
                );
            }
        }
    },
    'new Request().method(\'post\')' : {
        topic : function () {
            this.callback(null, new Request().method('post'));
        },
        'will update request.options.method to POST.' : function(error, request) {
            assert.strictEqual(request.options.method, 'POST');
        },
        'additional calls to request.method()' : {
            topic : function (request) {
                this.callback(null, request.method('put'));
            },
            'will update request.options.method' : function (error, request) {
                assert.strictEqual(request.options.method, 'PUT');
            }
        }
    },
    'new Request(path, {})' : {
        topic : function () {
            this.callback(null, new Request('', {
                protocol    : 'http:',
                basicAuth   : 'asdf:qwer',
                host        :'www.google.com',
                port        : 80,
                path        : '/new/place.php',
                query       : 'value=BigDeal',
                hash        : '#1234',
                method      : 'post'
            }));
        },
        'will apply all options to the Request object' : function (error, request) {
            assert.strictEqual(request.options.protocol, 'http:');
            assert.strictEqual(request.options.basicAuth, 'asdf:qwer');
            assert.strictEqual(request.options.host, 'www.google.com');
            assert.strictEqual(request.options.port, 80);
            assert.strictEqual(request.options.path, '/new/place.php');
            assert.strictEqual(request.options.query, '?value=BigDeal');
            assert.strictEqual(request.options.hash, '#1234');
            assert.strictEqual(request.options.method, 'POST');
        }
    },
    'new Request().form(data)' : {
        topic : function () {
            this.callback(null, new Request().form('query=value'));
        },
        'will set options.form' : function(error, request) {
            assert.strictEqual(request.options.form, 'query=value');
        },
        '.form(param2=value)' : {
            topic : function (request) {
                this.callback(null, request.form('param2=value'));
            },
            'will append the new value correctly' : function (error, request) {
                assert.strictEqual(request.options.form, 'query=value&param2=value');
            }
        }
    },
    'new Request().form({})' : {
        topic : function () {
            this.callback(null, new Request().form({
                'param1' : 'value1',
                'param2' : 'value2'
            }));
        },
        'will set options.form' : function (error, request) {
            assert.strictEqual(request.options.form, 'param1=value1&param2=value2');
        },
        '.form({})' : {
            topic : function (request) {
                this.callback(null, request.form({
                    'param3' : 'value3',
                    'param4' : 'value4'
                }));
            },
            'will append the new value correctly' : function (error, request) {
                assert.strictEqual(
                    request.options.form,
                    'param1=value1&param2=value2&param3=value3&param4=value4'
                );
            }
        }
    },
    'new Request(someURL).end()' : {
        topic : function () {
            return new Request(webServer(returnData('asdf')) + '/asdf').
                        end().
                        on('end', function (data) {
                            this.emit('success', data);
                        })
        },
        'will return the data' : function (data) {
            assert.strictEqual(data, 'asdf');
        }
    },
    'URL query params' : {
        topic : function(){
            new Request(webServer(this.callback) + '/asdf?param1=one&param2=two').end();
        },
        'are passed.' : function(request, response) {
            assert.strictEqual(request.url, '/asdf?param1=one&param2=two');
        }
    },
    'Setting additonal headers' : {
        topic : function(){
            new Request(webServer(this.callback) + '/asdf').
                header('param1', 'one').
                header('param2', 'two').
                end();
        },
        'sends the headers.' : function(request, response) {
            assert.ok('param1' in request.headers);
            assert.ok('param2' in request.headers);
            assert.strictEqual(request.headers.param1, 'one');
            assert.strictEqual(request.headers.param2, 'two');
        }
    },
    'new Request().method()' : {
        topic : function(){
            var self = this;
            new Request(webServer(this.callback) + '/asdf').
                method('post').
                end();
        },
        'sends the correct method.' : function(request, response) {
            assert.strictEqual(request.method, 'POST');
        }
    }
    
    /**
     * TODO
     * test form post
     * test RAW streaming
     * test multipart file
     * test pipe to the underlying request
     * test multiple pipe to the underlying request
     * test pipe from the underlying response
    */
    
}).export(module);






