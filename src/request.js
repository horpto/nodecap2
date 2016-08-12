"use strict";

var assign = require('./utils').assign;

// use as mixin, not classical inheritance
var Request = module.exports = function() {
  this.headers = null;
  this.method = '';
  this.uri = null;
  this.version = null;
  this.parsedUri = null;
};

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
