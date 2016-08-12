"use strict";

var util = require('util');
var Response = require('./response');

var HTTPResponse = module.exports = function() {
  Response.call(this, 'HTTP');
};
util.inherits(HTTPResponse, Response);
