var assert      = require('assert'),
    http        = require('http'),
    util        = require('util'),
    vows        = require('vows'),
    flow        = require('flow'),
    help        = require('./help.js')
    webServer   = help.webServer,
    returnData  = help.returnData,
    redirectServer = help.redirectServer;

vows.describe('How Service works').addBatch(
{
    'customRequest()' : {
        topic : function () {
            this.callback(null, flow.customRequest());
        },
        'will return the Request class' : function (error, CustomRequest) {
            assert.strictEqual(CustomRequest, flow.Request);
        }
    },
    'customRequest({options : {}})' : {
        topic : function () {
            this.callback(null, flow.customRequest({
                options : {
                    method  : 'put',
                    end     : true,
                    custom  : 'myValue',
                    headers : {
                        'user-agent'    : 'Custom Agent'
                    }
                }
            }));
        },
        'will return a CustomRequest with the right options' : function (error, CustomRequest) {
            assert.ok(
                flow.Request.prototype.isPrototypeOf(CustomRequest.prototype)
            );
            var options = CustomRequest.prototype.options;
            assert.strictEqual(options.method                   , 'PUT');
            
            assert.strictEqual(options.end                      , true);
            assert.strictEqual(options.custom                   , 'myValue');
            assert.strictEqual(options.headers['user-agent']    , 'Custom Agent');
            
            assert.strictEqual(options.encoding                 , 'utf-8');
        },
        'will not update the "global" Request' : function (error, CustomRequest) {
            assert.notStrictEqual(flow.Request, CustomRequest);
            
            var options = flow.Request.prototype.options;
            assert.strictEqual(options.method               , 'GET');
            
            assert.ok(!options.hasOwnProperty('end'));
            assert.ok(!options.hasOwnProperty('custom'));
            assert.strictEqual(options.headers['user-agent'], 'flow for node.js');
            
            assert.strictEqual(options.encoding             , 'utf-8');
        },
        ', a new instance' : {
            topic : function (CustomRequest) {
                this.CustomRequest = CustomRequest;
                
                this.callback(
                    null,
                    new CustomRequest('', {request:false})
                );
            },
            'will be an instance of Request' : function (error, customRequest) {
                assert.ok(customRequest instanceof flow.Request);
            },
            'will be an instance of CustomRequest' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        },
        ', a new instance of Request' : {
            topic : function (CustomRequest) {
                this.CustomRequest = CustomRequest;
                
                this.callback(
                    null,
                    new flow.Request('', {request:false})
                );
            },
            'will NOT be an instance of CustomRequest' : function (error, request) {
                assert.ok(!(request instanceof this.CustomRequest));
            }
        }
    },
    'customRequest({options : {}}, URI)' : {
        topic : function () {
            this.callback(null, flow.customRequest({
                    options : {
                        method  : 'put'
                    }
                },
                'http://asdf:qwer@www.google.com/new/place.php?value=BigDeal#1234'
            ));
        },
        'will return a CustomRequest with the right options' : function (error, CustomRequest) {
            assert.ok(
                flow.Request.prototype.isPrototypeOf(CustomRequest.prototype)
            );
            var options = CustomRequest.prototype.options;
            
            assert.strictEqual(options.method       , 'PUT');
            
            assert.strictEqual(options.protocol     , 'http:');
            assert.strictEqual(options.basicAuth    , 'asdf:qwer');
            assert.strictEqual(options.host         , 'www.google.com');
            assert.strictEqual(options.port         , 80);
            assert.strictEqual(options.path         , '/new/place.php');
            assert.strictEqual(options.query        , '?value=BigDeal');
            assert.strictEqual(options.hash         , '#1234');
           
            assert.strictEqual(options.encoding     , 'utf-8');
        },
        'will not update the "global" Request' : function (error, CustomRequest) {
            assert.notStrictEqual(flow.Request, CustomRequest);

             var options = flow.Request.prototype.options;
             assert.ok(!options.hasOwnProperty('custom'));
            
            assert.strictEqual(options.method       , 'GET');
            assert.strictEqual(options.encoding     , 'utf-8');
            
            assert.ok(!options.hasOwnProperty('protocol'));
            assert.ok(!options.hasOwnProperty('basicAuth'));
            assert.ok(!options.hasOwnProperty('host'));
            assert.ok(!options.hasOwnProperty('port'));
            assert.ok(!options.hasOwnProperty('path'));
            assert.ok(!options.hasOwnProperty('query'));
            assert.ok(!options.hasOwnProperty('hash'));
        }
    },
    'new Service(CustomRequest)' : {
        topic : function () {
            this.CustomRequest = flow.customRequest({
                options : {method : 'PUT'}
            });
            this.callback(null, new flow.Service(this.CustomRequest));
        },
        'will return a new Service' : function (error, customService) {
            assert.isFunction(customService.get);
            assert.isFunction(customService.put);
            assert.isFunction(customService.post);
            assert.isFunction(customService.del);
            assert.isFunction(customService.newRequest);
        },
        'will not update the Request class' : function () {
            var options = flow.Request.prototype.options;
            assert.strictEqual(options.method       , 'GET');
            assert.notStrictEqual(flow.Request, this.CustomRequest);
        },
        '.get()' : {
            topic : function (customService) {
                this.callback(null, customService.get('', {request:false}));
            },
            'will use the CustomRequest object passed' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        },
        '.put()' : {
            topic : function (customService) {
                this.callback(null, customService.put('', {request:false}));
            },
            'will use the CustomRequest object passed' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        },
        '.post()' : {
            topic : function (customService) {
                this.callback(null, customService.post('', {request:false}));
            },
            'will use the CustomRequest object passed' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        },
        '.del()' : {
            topic : function (customService) {
                this.callback(null, customService.del('', {request:false}));
            },
            'will use the CustomRequest object passed' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        },
        '.newRequest()' : {
            topic : function (customService) {
                this.callback(null, customService.newRequest('', {request:false}));
            },
            'will use the CustomRequest object passed' : function (error, customRequest) {
                assert.ok(customRequest instanceof this.CustomRequest);
            }
        }
    }
}).export(module);
