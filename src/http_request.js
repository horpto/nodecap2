"use strict";

const util = require('util');
const Request = require('./request');

const HTTPRequest = module.exports = function() {
  Request.call(this);
  this.protocol = 'HTTP';
};
util.inherits(HTTPRequest, Request);
