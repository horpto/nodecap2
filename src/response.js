"use strict";

var assign = require('./utils').assign;

// use as mixin, not classical inheritance
var Response = module.exports = function(protocol) {
  this.headers = {};
  this.protocol = protocol || "";
  this.version = '';
  this.code = 200;
};

assign(Response.prototype, {
  setHeaders: function(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    assign(this.headers, headers);
  }
});
