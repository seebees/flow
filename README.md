flow 0.1.0
===========

(C) ryan emery (seebees@gmail.com) 2011, Licensed under the MIT-LICENSE

An HTTP client library for node.js 

Features
--------

* Easy interface for common operations (get, put, post)
* option setters so you can pass options as an object or chain
* parser object for per content-type deserialization (automatically uses js-yaml and xml2js)
* add files for multipart requests
* http/https
* exposes an auth function to do custom auth, with a built in function for basic auth
* a request is a write stream to the underlying http.ClientRequest
* a request is a read stream from the underlying http.ClientResponse
* by default the entire response is buffered and returned for each completion event
* 404 is not always a bad thing, options['404OK'] makes 404 not return an error
* adding an option to a class will set the option for all requested based on that class
* simple function to create a custom request class
* simple function to create a service class that wraps a custom request
* can automatically follow redirects
    
API
---

### flow.newRequest(path, options)

Basic method to make a request of any type.  The function returns a Request object.

* _response_ emitted when the response is received.  Passed statusCode, and response.
* _error_ emitted when the request was unsuccessful.  Gets passed the body and the response as arguments.
* _end_ emitted when the response ends.  By default, passed body and response.

See Request for full details.

### flow.get(url, options)

Create a GET request. 

### flow.post(url, options)

Create a POST request.

### flow.put(url, options)

Create a PUT request.

### flow.del(url, options)

Create a DELETE request.

### new Request(path, options)

Creates a new request.  Anything passed in the options hash will be parsed by the named option setter for the class.  If no option setter exists it will be added to this.options.

### Request.request(options)

Creates the underlying http.ClientRequest.  Takes an optional options hash in case you want to set more options.

### Request.end(data)

Ends the underlying http.ClientRequest and writes the optional data

### Request.write(chunk)

Writes data to the underlying ClientRequest object.  Writes made before a request object is created are buffered and written when the ClientRequest object is made.

### Request.pause()

Pauses the underlying http.ClientResponse object

### Request.resume()

Resumes the underlying http.ClientResponse object

##### Option Setters
Every option setter below can be passed in the option hash.  Also every option setter below is chain-able.

## Request.mapOptions(options)
Not technically an option setter.  This is the meta function that maps the hash to individual option setters

## Request.uri(value)
Takes a URI and maps it into it's component parts.  Most option setters append, e.g.
request.uri('http://www.google.com/').uri('next').uri('/level');
will request 
http://www.google.com/next/level

## Request.protocol(value)
updates the protocol.  Supported values are 'http:' and 'https:'.  Realistically you should not need to set this.  Defaults to http:

## Request.basicAuth(value)
does not append.  expecting 'user:password'

## Request.host(value)
does not append

## Request.port(value)
does not append

## Request.path(value)
appends.  does not append leading / e.g.
.path('/').path('here') === '/here'

## Request.query(value)
appends.  takes either a string or object.  Will append '?' and '&' appropriately.  Objects are qs.stringify(value)

## Request.hash(value)
does not append.  Currently does not append the '#' either.  I should probably fix that.

## Request.method(value)
does not append.  Upper cases whatever you give me.

## Request.header(name, value)
if called before an http.ClientRequest it caches the headers.  After it will forward the request
to the http.ClientRequest object.  lcases all names since headers should be case insensitive and I'm lazy.  If you do not pass a value I will delete the header.

## Request.headers(value)
Takes an object.  Calls header for each key:value

## Request.followRedirects(value)
does what it says

## Request.form(value)
for POSTing a Form.  sets header('content-type', 'application/x-www-form-urlencoded')
The form object will be written on request.end()

## Request.encoding(value)
defaults to utf-8

## Request.file(path, options)
writes a file stream to the http.ClientRequest.  Sets transfer-encoding and content-type to multipart/form-data.  Uses draino.funnel to serialize the content, so pass as many files as you like.  The options are passed to fs.createReadStream.  other options include
* options.contentType 	//defaults to 'application/octet-stream'
* options.size			//if you don't pass the file size I will fs.stat before I open the stream

## Request.files(paths, options)
tries to be smart and call Request.file
If paths = [[path, options], [path,options]]
If paths = [path, path, path], options
If paths = {path:options, path:options}
Finally	 = [[path, options], path], options

## Request.auth(fn) 
an optional authentication function.  Called in the context of the Request and passed the http.ClientRequest.  Call right after the http.ClientRequest is created.

### options without setters
* options['404OK']			//if you don't want 404 to emit an error
* options.streamResponse	//if you want the response streamed (instead of only one data event)

### Request Events in the order emitted
* _request_ 	emitted when http.ClientRequest is created. passed (http.ClientRequest)
* _response_ 	emitted when http.ClientResponse is received. passed (statusCode, http.ClientResponse)
* _2XX_			the status class. e.g. 200, 201, 202 all emit 2XX, the same for 400 etc.  (not emitted for 302, 304) passed (body, http.ClientResponse)
* _200_			the status code e.g. 200, 202 etc. passed (body, http.ClientResponse)
* _data_		just like any other stream. passed (body)
* _end_			emitted at the end.  passed (body, http.ClientResponse)
## If options.streamResponse is true the events change slightly.  Since I am streaming the response I do not have the body to pass
* _2XX_			passed (null, http.ClientResponse)
* _200_			passed (null, http.ClientResponse)
* _data_		just like any other stream. passed (chunk)
* _end_			emitted at the end.  passed ()


### flow.customRequest(prototype, baseURL)
shorthand for creating a new Request object.  If you want your own option setters or default options.  e.g. everything relative to a baseURL or to change the user-agent on every request.

### new Service(ServiceRequest)
creates an object that implements newRequest, del, get, put, post using the given ServiceRequest object.  Ultimately this ServiceRequest is passed to customRequest so you can shorthand:
new Service(customeRequest({stuff})) into
new Service({stuff})

### flow.service(constructor, method, ServiceRequest)
to put all your implementation in one place.  I'm thinking of making everything inherit from EventEmitter, but that seems a little... forceful.

### flow.parsers

You can give any of these to Request.parser() to specify how the response data is deserialized.  The object uses the key as the content-type.  e.g. {'application/json' : function(){}}.  If you want to add your own, they are called with parser(data, contentType, callback).  (yes I pass the contentType.  it makes the auto parser simple.)

#### parsers.auto
if typeof parsers[contentType] === 'function' then
	parsers[contentType](data, contentType, callback)
else 
	callback(null, data)

Example usage
-------------

    var sys = require('sys'),
        flow = require('flow');

    flow.get('http://www.google.com').
		end().
		on('end', function(body) {
			//do something with the body
		});
		
	//Also the tests should document uses cases as well.

    
Running the tests
-----------------

    vows ./test/test* --spec
    
TODO
----
* Deal with no utf-8 response bodies
* What do you need? Let me know or fork.