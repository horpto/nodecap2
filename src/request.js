"use strict";

var util = require('util');
var _ = require('lodash');
var EventEmitter2 = require('eventemitter2').EventEmitter2;

var Request = module.exports = function() {
  EventEmitter2.call(this, {});
  this.headers = null;
  this.method = '';
  this.uri = null;
  this.version = null;
  this.parsedUri = null;
};
util.inherits(Request, EventEmitter2);

_.assign(Request.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    _.assign(this.headers, headers);
  },
  setMethod: function(method) {
    _.assign(this, method);
    if (!this.parsedUri) {
      this.parsedUri = {
        pathname: ''
      };
    }
  }
});
