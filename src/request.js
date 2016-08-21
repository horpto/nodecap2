"use strict";

// use as mixin, not classical inheritance
const Request = module.exports = function() {
  this.headers = null;
  this.method = '';
  this.line = ''; // line that parsed to method, uri etc
  this.uri = null;
  this.version = null;
  this.parsedUri = null;
};

Object.assign(Request.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    Object.assign(this.headers, headers);
  },
  setMethod: function(method) {
    Object.assign(this, method);
    if (!this.parsedUri) {
      this.parsedUri = {
        pathname: ''
      };
    }
  }
});
