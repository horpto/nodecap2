"use strict";

const codes = require('./codes');

/*
 *  ICAPError(code)
 *    Creates a custom error with error code `code` or the given string message.
 *    @param code: numeric error code or string message
 */
module.exports = class ICAPError extends Error {
  constructor(code) {
    super();
    let message;
    if (typeof code === 'string') {
      message = code;
      code = null;
    } else {
      message = codes[code] || 'ICAP Error';
    }
    this.message = message;
    this.code = code;
  }
};
