"use strict";

const Request = require('./request');

module.exports = class HTTPRequest extends Request {
  constructor() {
    super();
    this.protocol = 'HTTP';
  }
};
