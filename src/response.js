"use strict";

var util = require('util');
var EventEmitter = require('eventemitter3');
var assign = require('./utils').assign;

var Response = module.exports = function(stream) {
  EventEmitter.call(this);
  this.headers = {};
  this.protocol = '';
  this.version = '';
  this.code = 200;
};
util.inherits(Response, EventEmitter);

assign(Response.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    assign(this.headers, headers);
  }
});
