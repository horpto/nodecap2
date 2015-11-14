"use strict";

var util = require('util');
var codes = require('./codes');

/*
 *  ICAPError(code)
 *    Creates a custom error with error code `code` or the given string message.
 *    @param code: numeric error code or string message
 */
function ICAPError(code) {
  var message;
  Error.call(this);
  Error.captureStackTrace(this, this.constructor);
  if (typeof code === 'string') {
    message = code;
    code = null;
  } else {
    message = codes[code] || 'ICAP Error';
  }
  this.message = message;
  this.code = code;
}
util.inherits(ICAPError, Error);

module.exports = ICAPError;
