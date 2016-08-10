"use strict";

var util = require('util');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var assign = require('./utils').assign;

var Request = module.exports = function() {
  EventEmitter2.call(this, {});
  this.headers = null;
  this.method = '';
  this.uri = null;
  this.version = null;
  this.parsedUri = null;
};
util.inherits(Request, EventEmitter2);

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
