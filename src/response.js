"use strict";

// use as mixin, not classical inheritance
const Response = module.exports = function(protocol) {
  this.headers = {};
  this.protocol = protocol || "";
  this.version = '';
  this.code = 200;
};

Object.assign(Response.prototype, {
  setHeaders(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    Object.assign(this.headers, headers);
  }
});
