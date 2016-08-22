"use strict";

const Response = require('./response');

module.exports = class HTTPResponse extends Response {
  constructor() {
    super('HTTP');
  }
};
