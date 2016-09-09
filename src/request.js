'use strict';

// use as mixin, not classical inheritance
module.exports = class Request {
  constructor() {
    this.headers = null;
    this.method = '';
    this.line = ''; // line that parsed to method, uri etc
    this.uri = null;
    this.version = null;
    this.parsedUri = null;
  }
  // TODO: more robust support of caseless
  getHeader(header) {
    if (!this.headers){
      return null;
    }
    const headerLowerCase = header.toLowerCase();
    const headers = this.headers;
    for (const name in headers) {
      if (headerLowerCase == name.toLowerCase()) {
        return headers[name];
      }
    }
  }
  setHeader(header, value) {
    if (!this.headers){
      this.headers = {};
    }

    const headerLowerCase = header.toLowerCase();
    const headers = this.headers;
    for (const name in headers) {
      if (headerLowerCase == name.toLowerCase()) {
        this.headers[name] = value;
        return;
      }
    }
  }
  setHeaders(headers) {
    if (!this.headers) {
      this.headers = headers;
      return;
    }
    Object.assign(this.headers, headers);
  }
  setMethod(method) {
    Object.assign(this, method);
    if (!this.parsedUri) {
      this.parsedUri = {
        pathname: ''
      };
    }
  }
};
