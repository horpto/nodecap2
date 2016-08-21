"use strict";

const util = require('util');
const Response = require('./response');

const HTTPResponse = module.exports = function() {
  Response.call(this, 'HTTP');
};
util.inherits(HTTPResponse, Response);
