"use strict";

var util = require('util');
var _ = require('lodash');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

var Response = module.exports = function(stream) {
  EventEmitter2.call(this, {});
  this.headers = {};
  this.protocol = '';
  this.version = '';
  this.code = 200;
};
util.inherits(Response, EventEmitter2);

_.extend(Response.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    _.extend(this.headers, headers);
  }
});
