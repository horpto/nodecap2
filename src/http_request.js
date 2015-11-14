"use strict";

var util = require('util');
var Request = require('./request');

var HTTPRequest = module.exports = function() {
  Request.apply(this);
  this.protocol = 'HTTP';
};
util.inherits(HTTPRequest, Request);
