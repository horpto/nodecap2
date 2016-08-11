"use strict";

var util = require('util');
var EventEmitter = require('eventemitter3');
var assign = require('./utils').assign;

var Request = module.exports = function() {
  EventEmitter.call(this);
  this.headers = null;
  this.method = '';
  this.uri = null;
  this.version = null;
  this.parsedUri = null;
};
util.inherits(Request, EventEmitter);

assign(Request.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    assign(this.headers, headers);
  },
  setMethod: function(method) {
    assign(this, method);
    if (!this.parsedUri) {
      this.parsedUri = {
        pathname: ''
      };
    }
  }
});
