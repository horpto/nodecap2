'use strict';

// use as mixin, not classical inheritance

module.exports = class Response {
  constructor(protocol) {
    this.headers = {};
    this.protocol = protocol || '';
    this.version = '';
    this.code = 200;
  }
  setHeaders(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    Object.assign(this.headers, headers);
  }
};
