"use strict";

var util = require('util');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var assign = require('./utils').assign;

var Response = module.exports = function(stream) {
  EventEmitter2.call(this, {});
  this.headers = {};
  this.protocol = '';
  this.version = '';
  this.code = 200;
};
util.inherits(Response, EventEmitter2);

assign(Response.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    assign(this.headers, headers);
  }
});
