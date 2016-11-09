"use strict";

var util = require('util');
var Transform = require('stream').Transform;
var Response = require('./response');
var codes = require('./codes');
var currentISTag = "NODECAP-" + (new Date()).getTime();

var crlf = '\r\n';
var DEFAULT_CHUNK_SIZE = 4096;

var assign = require('./utils').assign;

var ICAPResponse = module.exports = function(id, stream, options) {
  Response.call(this, 'ICAP');

  options = assign(options || {}, {
    encoding: null, decodeStrings: true,
    objectMode: false,
    read: null, write: null, writev: null});
  Transform.call(this, options);

  this.pipe(stream, {end: false});

  this.id = id;
  this.done = false;
  this.filter = null;
  this.sendData = null;
  this.hasBody = false;
  this.chunkSize = 'chunkSize' in options ? options.chunkSize : DEFAULT_CHUNK_SIZE;
  this.icapStatus = null;
  this.icapHeaders = {};
  this.httpMethodType = '';
  this.httpMethod = null;
  this.httpHeaders = {};
  this.buffer = null;
};
util.inherits(ICAPResponse, Transform);

assign(ICAPResponse.prototype, Response.prototype, {
  _getCode: function(code, options) {
    code = code || 500;
    options = options || {};
    var description = codes[code];
    description = description ? description[0] : "Unknown";
    return [options.version || 'ICAP/1.0', code, description];
  },
  setIcapStatusCode: function(code, options) {
    this.icapStatus = this._getCode(code, options);
  },
  setIcapHeaders: function(headers) {
    // TODO: filter headers???
    this.icapHeaders = assign(this.icapHeaders, headers);
  },
  setHttpMethod: function(options) {
    this.httpMethodType = 'request';
    this.httpMethod = [options.method, options.uri, options.version || 'HTTP/1.1'];
  },
  setHttpStatus: function(code, options) {
    if (typeof code === 'object') {
      options = code;
      code = options.code || null;
    }
    options = options || {};
    options.version = options.version || 'HTTP/1.1';
    this.httpMethodType = 'response';
    this.httpMethod = this._getCode(code, options);
  },
  setHttpHeaders: function(headers) {
    this.httpHeaders = assign(this.httpHeaders, headers);
  },
  hasFilter: function() {
    return typeof this.filter === 'function';
  },
  setFilter: function(callAtEnd, filterFn) {
    if (typeof callAtEnd === 'function') {
      filterFn = callAtEnd;
      callAtEnd = false;
    }
    this.buffer = callAtEnd ? new Buffer(0) : null;
    this.filter = filterFn;
  },
  _joinHeaders: function (status, headers) {
    var block = status.join(' ') + crlf;
    for (var key in headers) {
      var value = headers[key];
      key += ": ";
      if (Array.isArray(value)) {
        for (var i = 0, l=value.length; i < l; ++i) {
          block += key + value[i] + crlf;
        }
      } else {
        block += key + value + crlf;
      }
    }
    return block;
  },
  _setEncapsulatedHeader: function(hasBody, headerBlock) {
    var encapsulated = [];
    var bodyType = "null-body";
    if (this.httpMethodType === 'request') {
      encapsulated.push('req-hdr=0');
      if (hasBody) {
        bodyType = 'req-body';
      }
    } else {
      encapsulated.push('res-hdr=0');
      if (hasBody) {
        bodyType = 'res-body';
      }
    }
    encapsulated.push(bodyType + '=' + headerBlock.length);
    this.icapHeaders['Encapsulated'] = encapsulated.join(', ');
  },

  _checkDefaultIcapHeaders: function() {
    this.icapHeaders['Date'] = (new Date()).toGMTString();
    if (!this.icapHeaders['ISTag']) {
      this.icapHeaders['ISTag'] = currentISTag;
    }
    if (!this.icapHeaders['Server']) {
      this.icapHeaders['Server'] = "Nodecap/1.0";
    }
  },

  writeHeaders: function(hasBody) {
    this.hasBody = hasBody;

    if (!this.icapStatus) {
      // TODO: user should always call setIcapStatusCode(), could throw error
      this.setIcapStatusCode();
    }
    // http status/headers
    var headerBlock = '';
    if (!!this.httpMethodType) {
      headerBlock = this._joinHeaders(this.httpMethod, this.httpHeaders) + crlf;
      this._setEncapsulatedHeader(hasBody, headerBlock);
    }
    // icap status/headers
    this._checkDefaultIcapHeaders()
    var icapBlock = this._joinHeaders(this.icapStatus, this.icapHeaders);
    this.push(icapBlock + crlf + headerBlock);
  },

  allowUnchanged: function(icapResponse) {
    // user should check status 204 is allowed own
    this.setIcapStatusCode(204);
    this.writeHeaders(false);
    this.end();
  },

  continuePreview: function() {
    var code = this._getCode(100);
    this.push(code.join(' ') + crlf + crlf);
  },

  _writeHandyChunk: function(data) {
    // filter output and abort if no response
    // note: this allows filter authors to buffer data internally
    if (this.filter) {
      data = this.filter(data);
      if (!data) {
        return;
      }
    }

    // data are always Buffer instance due to 'decodeStrings: true' option.
    this.push(data.length.toString(16) + crlf);
    this.push(data);
    this.push(crlf);
  },

  // TODO: more async
  _divideIntoHandyChunks: function(data, cb) {
    var size = this.chunkSize;
    var tmp = data.slice(0, size);
    data = data.slice(size);
    while (tmp.length) {
      this._writeHandyChunk(tmp);
      tmp = data.slice(0, size);
      data = data.slice(size);
    }
    return cb();
  },

  _writeChunk: function(data, cb) {
    if (this.buffer) {
      // TODO: maybe concat in buffer
      this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
      return cb();
    }
    if (data.length > this.chunkSize) {
      return this._divideIntoHandyChunks(data, cb);
    }
    this._writeHandyChunk(data);
    return cb();
  },

  // alert the filter that stream is over
  // can return data to write it before the stream is ended
  _streamIsOver: function() {
    if (this.filter && this.buffer) {
      var data = this.filter(this.buffer);
      this.filter = null;
      this.buffer = null;
      if (data) {
        this.write(data);
      }
    }
    this.push('0\r\n\r\n');
  },

  _transform: function(data, _, cb) {
    // not write null chunks because they signal about end of stream
    if (data.length) {
      return this._writeChunk(data, cb);
    }
    return cb();
  },

  // TODO: legacy, remove from next version
  _write: function(data, enc, cb) {
    if (cb == null) {
      if (data) {
        this.write(data);
      } else {
        this.end();
      }
      return;
    }
    return Transform.prototype._write.call(this, data, enc, cb);
  },

  send: function(data) {
    this.sendData = data;
  },

  _flush: function(cb) {
    if (this.hasBody) {
      if (this.sendData) {
        this.write(this.sendData);
        this.sendData = null;
      }
      this._streamIsOver();
    }
    this.done = true;
    cb();
  }
});
