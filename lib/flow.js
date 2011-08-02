var util            = require('util'),
    http            = require('http'),
    https           = require('https'),
    draino          = require('draino'),
    url             = require('url'),
    fs              = require('fs'),
    qs              = require('querystring'),
    /**
     * Nice function to apply the properties of source to target
     */
    mixin     = function (target, source) {
        target = target || {};
        Object.keys(source).forEach(function (key) {
            target[key] = source[key];
        });
      
        return target;
    },
    /**
     * simple function to put the whole implementation in one place
     * it wraps util.inherits()
     * @param parent        the parent (first for readability)
     * @param child         the constructor function
     * @param prototype     an object literal to append to child.prototype
     */
    inherit = function (parent, child, prototype) {
        if (typeof child !== 'function') {
            if (typeof child === 'object') {
                prototype = child;
            }
            child = function () {
                parent.apply(this, arguments);
            };
        }
        util.inherits(child, parent);
        child.prototype = mixin(child.prototype, prototype);
        
        return child;
    },
    /**
     * An object to store authentication options
     * A request object should be able to be created to use
     * any give authentication
     */
    authentication = {
        basic : function (request) {
            //var authParts, b;
            //
            //if (this.url.auth) {
            //    authParts = this.url.auth.split(':');
            //    this.options.username = authParts[0];
            //    this.options.password = authParts[1];
            //}
            //
            //if (this.options.username && this.options.password) {
            //    b = new Buffer([this.options.username, this.options.password].join(':'));
            //    this.headers.Authorization = "Basic " + b.toString('base64');
            //}
        }
    },
    /**
     * specific parsers for different content-types
     * to implement an additional parser simple apply a function to
     * the content type that accepts (data, callback)
     */
    parsers = {
        auto: function (data, contentType, callback) {
            if (    contentType 
                 && parsers.hasOwnProperty(contentType)
                 && typeof parsers[contentType] === 'function'
                ) {
                parsers[contentType](data, contentType, callback);
            } else {
                callback(null, data);
            }
        },
        'application/json': function (data, contentType, callback) {
            try {
                callback(null, JSON.parse(data));
            } catch (ex) {
                callback(ex, data);
            }
        },
        'application/yaml' : (function () {
            try {
                var yaml = require('yaml');
                
                return function (data, contentType, callback) {
                    try {
                        callback(null, yaml.eval(data));
                    } catch (ex) {
                        callback(ex, data);
                    }
                };
            } catch (e) {
                return false;
            }
        }()),
        'application/xml' : (function () {
            try {
                var xml2js = require('xml2js');
                
                return function (data, contentType, callback) {
                    if (data) {
                        (new xml2js.Parser()).
                            on('end', function (result) {
                                callback(null, result);
                            }).
                            on('error', function (ex) {
                                callback(ex, data);
                            }).
                            parseString(data);
                        
                    } else {
                        callback(null, data);
                    }
                };
            } catch (e) {
                return false;
            }
        }())
    },
    /** helper methods
     * 
     */
    isRedirect = function (response) {
        return ([301, 302].indexOf(response.statusCode) >= 0);
    },
    parseURI = function (uri, to) {
        var tmp;
        
        if (to) {
            //we have a location
            tmp = url.resolveObject({
                protocol : uri.protocol,
                auth     : uri.basicAuth,
                hostname : uri.host,
                port     : uri.port,
                pathname : uri.path,
                search   : uri.query,
                hash     : uri.hash
            }, to);
        } else {
            //TODO handle a URI that is formatted ala the http.request format
            tmp = url.parse(uri);
        }
            
        return {
            protocol  : tmp.protocol || 'http',
            basicAuth : tmp.auth     || '',
            host      : tmp.hostname || '',
            port      : tmp.port     || (tmp.protocol === 'https:' ? 443 : 80),
            path      : tmp.pathname || '/',
            query     : tmp.search   || '',
            hash      : tmp.hash     || ''
        };
    };
    

/**
 * The base request object.  All requests funnel through here
 * A new Request() is an EventEmitter that will emit all manner of
 * wonderful events but especially, success and complete
 */
var BasicRequest = inherit(
    //parent
    draino.SerialPump,
    //constructor
    function () {
        draino.SerialPump.call(this);
        this.buffer = new draino.StreamBuffer(this);
    },
    {
        /**
         *  default options
         */
        options     : {
            'headers'           : {
                'accept'            : '*/*',
                'user-agent'        : 'flow for node.js'
            },
            
            'method'            : 'GET',
            'encoding'          : 'utf-8',
            'followRedirects'   : true,
            'parser'            : parsers.auto
        },
        /**
         * I am a stream.
         * As a WriteStream I write to the underlying http.ClientRequest
         *      before the .request() method is called all writes are buffered
         * As a ReadStream I read from the underlying http.ClientResponse
         */
        writable    : true,
        readable    : true,
        //TODO do I need to support an optional encoding param here?
        write       : function (chunk) {
            if (this._request) {
                this._request.write(chunk);
            } else {
                //The class buffers itself until the request is made,
                //so this error should never be thrown.  but...
                throw new Error('There is no request to write to');
            }
        },
        pause       : function () {
            if (this._response) {
                this._response.pause();
            } else {
                //throw error
            }
        },
        resume      : function () {
            if (this._response) {
                this._response.resume();
            } else {
                //throw error
            }
        },
        /**
         * to make the request
         */
        request : function (options) {
            var self = this;
            
            //I will only make 1 http.request per Request object.
            //If I make more then one, then I would emit more then one 'end' event,
            //which is contrary to the Stream specification in node.js
            if (!self._request) {
                if (options) {
                    self.mapOptions(options);
                }
                //yes, yes, but above I just mapped them and this way I can type less
                var options = self.options;
                var proto   = (options.protocol === 'https:') ? https : http;
                
                if (!options.host) {
                    throw new Error('unable to make a request with out a host, check your URI');
                }
                
                self._request = proto.request({
                        host    : options.host,
                        port    : options.port,
                        path    : [options.path, options.query, options.hash].join(''),
                        method  : options.method,
                        headers : options.headers
                    }).
                    on('response', function (response) {
                        self.handleResponse(response);
                    });
                
                //update the header method to pass directly to _request
                self.header = function (name, value) {
                    //TODO is this a bug in node?  in http.js there is a headerSent value...
                    if (!this._request._header) {
                        if (typeof name === 'string' && typeof value === 'string') {
                            this._request.setHeader(name, value);
                        } else if (typeof name === 'string' && !value) {
                            this._request.removeHeader(name, value);
                        }
                    }
                    return this;
                };
                
                //if there is a custom authentication function, call it
                if (typeof self.options.auth === 'function') {
                    self.options.auth.call(self, self._request);
                }
                
                //StreamBuffer::drain will remove it from the "equation."
                //this means the default write will be replaced and all
                //buffered data will be written to the underlying request.
                this.buffer.drain();
                
                //Let the work know we have a request object
                self.emit('request', self._request);
            }
            
            return this;
        },
        /**
         * Method to get a new request from the current request.
         * This method get's eaten if you use the REST implementation, but the
         * new method does exactly the same thing.
         * This method is here in case you create a request with new Request()
         */
        newRequest  : function (path, options) {
            //I use the constructor of this instance instead of Request in case
            //someone has a derived class with custom options
            return new this.constructor(path, options);
        },
        /**
         * this ends the ReadStream portion of the program and calls end on
         * the underlying ClientRequest object
         */
        end : function (data) {
            var self = this;
            //make sure this.request() has been run
            if (!self._request) {
                self.request();
            }
            
            if (self.options.form) {
                //    header('content-length', self.options.form.length).
                self.write(self.options.form);
            }
            
            //TODO, this may not be a good idea.  But it is hear to deal with
            //the conflict between calling end with an option and needing to
            //wait for all streams to complete
            if (!self._funnulBuff || !self._funnlBuff.length) {
                self._request.end(data);
            }
            
            return this;
        },
        /**
         *Helper function to emit a description of the data
         *I got back.  probably overkill
         */
        emitResponses   : function (body, response) {
            var self = this;
            
            //404 is not necessarily a bad thing
            if (response.statusCode >= 400 &&
                !self.options['404OK']
            ) {
                self.emit('error',   body, response);
            }
            
            var statusCode  = response.statusCode.toString();
            var statusClass = statusCode.replace(/\d{2}$/, 'XX');
            
            self.emit(statusClass,  body, response);
            self.emit(statusCode,   body, response);
        },
        /**
         * response methods
         */
        handleResponse: function (response) {
            var self = this;
            if (isRedirect(response) && self.options.followRedirects) {
                try {
                    self.options.redirect_count = self.options.redirect_count || 0;
                    self.options.redirect_count += 1;
                    
                    //protect against some kind of crazy chain
                    if (self.options.redirect_count > 10) {
                        //arbitrarily stop at 10.  I mean really... 10 redirects?
                        self.emit('error', new Error('Failed to follow redirect over 10 redirects'));
                    }
                    //TODO should I emit a response event to tell people about the 302?
                    // I should really handle 302, 303, 307 differently but...
                    self.
                        newRequest(response.headers.location, {method : 'get'}).
                        end().
                        //Return the response back to the original Request
                        on('response', function (statusCode, response) {
                            self.handleResponse(response);
                        }).
                        //Set the redirect count on the new request
                        options.redirect_count = self.options.redirect_count;
                } catch (e) {
                    self.emit('error', e, 'Failed to follow redirect');
                }
            } else {
                self._response = response;
                
                if (self.options.encoding) {
                    response.setEncoding(self.options.encoding);
                }
                
                self.emit('response', response.statusCode, response);
                
                //If the world wants the data as a stream
                if (self.options.streamResponse) {
                    //tell the world to expect data
                    self.emitResponses(null, response);
                    //Parsing the stream is not supported.
                    //if you pipe from me you will get what you want now.
                    response.
                        on('data', function (chunk) {
                            self.emit('data', chunk);
                        }).
                        on('end', function () {
                            self.emit('end');
                        }).
                        on('error', function (ex) {
                           self.emit('error', ex);
                        });
                } else {
                    //First we flush the data out of the response Stream
                    var buff = new draino.StreamBuffer();
                    response.pipe(buff);
                    buff.on('full', function () {
                        //The data, in the parser I call it body
                        var data = this.read();
                        //Now that I have the data...
                        //If I have a parser, use it
                        if (typeof self.options.parser === 'function') {
                            self.options.parser(
                                data,
                                response.headers['content-type'],
                                function  (err, body) {
                                    //The auto parser does not return an error
                                    //if it does not find parser for the given
                                    //content-type
                                    if (err) {
                                        self.emit('error', err);
                                        return;
                                    }
                                    //tell the world to expect data
                                    self.emitResponses(body, response);
                                    self.emit('data',  body);
                                    self.emit('end',   body, response);
                                }
                            );
                        } else {
                            //no parser, sadness
                            self.emitResponses(data, response);
                            self.emit('data',  data);
                            self.emit('end',   data, response);
                        }
                        
                    }).
                    //if I get an error, pass it on up
                    on('error', function (ex) {
                        self.emit('error', ex);
                    });
                    
                }
            }
        }
    }
);
/**
 * I am separating the implementation from the option setters
 * The purpose is:
 *      1. to make the code readable (only the implementation is in BasicRequest)
 *      2. chain options when creating a Request, if you like that syntax
 *      3. handle logic for specific options e.g. file or header to simplify,
 *          implementation logic.
 */
var Request = inherit(
    BasicRequest,
    function (path, options) {
        //inherit
        BasicRequest.call(this);
        
        //this makes it easy to control base options across instances, but
        //I need to have a new object for each request
        this.options = Object.create(this.options);
        //this is commitment to an idea, but I'm not going to do it recursively
        for(var i in this.options) {
            if (Array.isArray(this.options[i])) {
                this.options[i] = this.options[i].slice();
            } else if (typeof this.options[i] === 'object') {
                this.options[i] = Object.create(this.options[i]);
            }
        }
        
        //map the default options
        this.mapOptions(this.options);
        
        //map the path
        if (path) {
            this.uri(path);
        }
        //map the given options
        if (options) {
            this.mapOptions(options);
        }
        
        if (this.options.request !== false) {
            if (this.options.request) {
                this.request();
            }
            if (this.options.end) {
                this.end();
            }
        }
    },
    {
        mapOptions  : function (options) {
            if (options) {
                var self    = this;
                
                for (i in options) {
                    if (options.hasOwnProperty(i)) {
                        if (    typeof self[i] === 'function'
                            && !BasicRequest.prototype.hasOwnProperty(i)
                        ) {
                            self[i](options[i]);
                        } else {
                            self.options[i] = options[i];
                        }
                    }
                }
            }
            return this;
        },
        //option setters
        uri : function (uri) {
            if (uri) {
                if (!this.options.host) {
                    mixin(this.options, parseURI(uri));
                } else {
                    mixin(this.options, parseURI(this.options, uri));
                }
            }
            return this;
        },
        protocol : function (value) {
            if (typeof value === 'string') {
                //TODO hoist out a map of supported values
                this.options.protocol = value;
            }
            return this;
        },
        basicAuth : function (value) {
            if (typeof value === 'string') {
                this.options.basicAuth = value;
            }
            return this;
        },
        host : function (value) {
            if (typeof value === 'string') {
                this.options.host = value;
            }
            return this;
        },
        port : function (value) {
            if (!isNaN(parseInt(value, 10))) {
                this.options.port = value;
            }
            return this;
        },
        path : function (value) {
            if (typeof value === 'string') {
                if (!this.options.path) {
                    this.options.path = value;
                } else {
                    this.options.path += value;
                }
            }
            return this;
        },
        query : function (value) {
            if (!this.options.query) {
                this.options.query = '?';
            } else if (value) {
                this.options.query += '&';
            }
            
            if (typeof value === 'string') {
                this.options.query += value;
            } else {
                this.options.query += qs.stringify(value);
            }
            return this;
        },
        hash : function (value) {
            //TODO starting #?
            if (typeof value === 'string') {
                this.options.hash = value;
            }
            return this;
        },
        method : function (value) {
            if (typeof value === 'string') {
                this.options.method = value.toUpperCase();
            }
            return this;
        },
        header : function (name, value) {
            if (typeof name === 'string') {
                if (typeof value !== 'undefined') {
                    this.options.headers[name.toLowerCase()] = value;
                } else {
                    delete this.options.headers[name];
                }
            }
            return this;
        },
        headers : function (object) {
            var i;
            for (i in object) {
                if (object.hasOwnProperty(i)) {
                    this.header(i, object[i]);
                }
            }
            return this;
        },
        followRedirects : function (value) {
            this.options.followRedirects = !!value;
            return this;
        },
        form : (function () {
                function form (value) {
                    if (!this.options.form) {
                        this.options.form = '';
                    } else if (value) {
                        this.options.form += '&';
                    }
                    
                    if (typeof value === 'string') {
                        this.options.form += value;
                    } else {
                        this.options.form += qs.stringify(value);
                    }
                    return this;
                }
                return function (value) {
                    this.header('content-type', 'application/x-www-form-urlencoded');
                    this.form = form;
                    return this.form(value);
                };
        }()),
        encoding : function (value) {
            if (typeof value === 'string') {
                //TODO hoist out map of supported values
                this.options.encoding = value;
            } else if (!value) {
                delete this.options.encoding;
            }
            return this;
        },
        file : (function () {
            /**
             * The primary file implementation.
             */
            function file (path, options) {
                var self = this;
                
                options = options || {};
                //TODO is this the fastest?
                options.bufferSize  = options.bufferSize  || 64 * 1024;
                options.contentType = options.contentType || 'application/octet-stream';
                
                function streamFile(err, stats) {
                    if (err) {
                        //TODO throw error
                    }
                    
                    var fileStream = fs.createReadStream(path, options);
                    self.funnel(fileStream);
                    
                    fileStream.emit('data',
                         '--' + self.options.boundry +                  '\r\n' +
                        'Content-Disposition: form-data; '                     +
                        'name="'           + self.options.name + '";'          +
                        'filename="'       + (options.name || path) +  '"\r\n' +
                        'Content-Length: ' + stats.size +               '\r\n' +
                        'Content-Type: '   + options.contentType +      '\r\n\r\n'
                     );
                }
                
                if (options.size > 0) {
                    streamFile(null, options);
                } else {
                    fs.stat(path,streamFile);
                }
                
                return this;
            }
            /**
             * I need to set a few headers only once.  So this function exists
             * to do the initial setup and then eat itself
             */
            return function fileSetup (path, options) {
                //TODO setup header('Transfer-Encoding', 'chunked');
                this.header(
                    'content-type',
                    'multipart/form-data; boundary=' + self.options.boundry
                );
                this.file = file;
                return this.file(path, options);
            };
        }()),
        files : function (paths, options) {
            if (Array.isArray(paths)) {
                paths.forEach(function (path) {
                    if (Array.isArray(path)) {
                        this.file.apply(this, path);
                    } else {
                        this.file(path, options);
                    }
                });
            } else if (paths) {
                var i;
                for(i in paths) {
                    if (paths.hasOwnProperty(i)) {
                        this.file(i, path[i]);
                    }
                }
            }
            return this;
        },
        auth : function (fn) {
            if (typeof fn === 'function') {
                this.options.auth = fn;
            }
            return this;
        }
        //TODO make option for parser
    }
)


/**
 * The base static entry-point for the whole kit and kaboodle.
 * The instance exposes 5 methods (newRequest, get, put, post, del).
 * Each method is pure and can be copied off and put wherever you like.
 * If you want a new Service with a special Request object that implements
 * a special Authentication scheme for example, inherit from Request,
 * change the .options.auth function on your class enjoy.
 * See the tests or customRequest for details
 */
var Service = function (ServiceRequest) {
    var actions = {
            newRequest: function (path, options) {
                //return a new ServiceRequest object and expose the REST
                //implementation again so people can chain if they like
                return mixin(
                    new ServiceRequest(path, options),
                    actions
                );
            },
            del: function (path, options) {
                //have to pass the method this way because a derived
                //class may pass an 'end' or 'request' option
                options = options || {};
                options.method = 'DELETE';
                return actions.newRequest(path, options);
            }
        };

    //Append get, put, post implementation
    ['get', 'put', 'post'].forEach(function (func) {
        actions[func] = function (path, options) {
            //have to pass the method this way because a derived
            //class may pass an 'end' or 'request' option
            options = options || {};
            options.method = func;
            return actions.newRequest(path, options);
        };
    });
    
    //make sure the ServiceRequest is a rational form of Request
    ServiceRequest = customRequest(ServiceRequest);
    
    //expose
    mixin(this, actions);
};

/**
 * Shorthand for creating new Services
 * @param {function}    arg1 the constructor
 * @param {object}      arg2 an object to be appended to the constructors prototype
 * @param               arg3 an optional Request object (see customRequest)
 */
var service = function (constructor, methods, ServiceRequest) {
    //mixin the service methods first, if you want to stop on my methods,
    //that's your problem
    mixin(constructor.prototype, new Service(ServiceRequest));
    mixin(constructor.prototype, methods);
    return constructor;
};

/**
 *  Factory for custom Requests.
 *
 *  @param          arg1    expected to be a new object of methods that you want
 *                          to append but if you only pass a string I will do the
 *                          "right" thing, Also if you pass an instance of
 *                          Request or a class that is a child of Request
 *                          I will do the right thing
 *  @param {String} arg2    a URL that subsequent requests will be relative to
 */
var customRequest = function (prototype, baseURL) {
    //Since the Request object does the best job of parsing it's own
    //options, I create an instance and let it do the parsing and then
    //inherit
    if (typeof prototype === 'function') {
        if (Request.prototype.isPrototypeOf(prototype.prototype)) {
            if (baseURL) {
                //prototype is a Request, let it do the parsing
                //map baseURL with {request:false} to avoid errant requests.
                var tmp = new prototype(baseURL, {request: false});
                //remove the request option 'cause I added it not you
                delete tmp.options.request;
                
                //inherit and enjoy.  It may seem silly to inherit in this case,
                //but I don't think that the expected thing would be to modify
                //the give request object.  especial if the given object is Request
                return inherit(
                    prototype,
                    {
                        options : tmp.options
                    }
                );
            } else {
                //uh, OK, looks like you already did all the work, thanks
                return prototype;
            };
        } else if (typeof prototype === 'string' && !baseURL) {
            //nice, OK I can swap the variables around for you.
            //first I need to build a better prototype,
            
            //map baseURL with {request:false} to avoid errant requests.
            var tmp = new Request(prototype, {request: false});
            //remove the request option 'cause I added it not you
            delete tmp.options.request;
            
            //inherit enjoy (I inherit 'cause I don't want to update the "global" Request)
            return inherit(
                Request,
                {
                    options : tmp.options
                }
            );
        } else {
            throw new Error('not sure what you have given me, so I don\'t know what to do');
        }
    } else if (prototype instanceof Request) {
        //this is easy
        return inherit(
            //in case you are a derived class already I don't want to disrespect
            //your ancestors or anything
            prototype.constructor,
            {             //merge the options
                options : prototype.uri(baseURL).options
            }
        );
    } else if (typeof prototype === 'object') {
        //OK, now this makes sense
        //map baseURL with {request:false} to avoid errant requests.
        var tmp = new Request(baseURL, {request: false});
        //remove the request option 'cause I added it not you
        delete tmp.options.request;
        //update prototype.options with the newly merged options
        prototype.options = tmp.mapOptions(prototype.options).options;
        
        //inherit and enjoy
        return inherit(
            Request,
            prototype
        );
    } else {
        //if all else fails you get a Request. (should I inherit so you have your own?)
        return Request;
    }
};

//Export the basic REST functions
module.exports = new Service();

//Export helper functions and Classes so people can customize 
mixin(module.exports, {
    Request         : Request,
    Service         : Service,
    service         : service,
    customRequest   : customRequest,
    parsers         : parsers,
    authentication  : authentication
});


