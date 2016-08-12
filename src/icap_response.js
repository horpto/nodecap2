"use strict";

var util = require('util');
var Response = require('./response');
var codes = require('./codes');
var currentISTag = "NODECAP-" + (new Date()).getTime();

var crlf = '\r\n';
var DEFAULT_CHUNK_SIZE = 4096;

var assign = require('./utils').assign;

var ICAPResponse = module.exports = function(id, stream, options) {
  Response.call(this);
  this.stream = stream;
  this.id = id;
  this.protocol = 'ICAP';
  this.done = false;
  this.filter = null;
  this.sendData = null;
  this.allowUnchangedAllowed = true;
  this.chunkSize = 'chunkSize' in options ? options.chunkSize : DEFAULT_CHUNK_SIZE;
  this.icapStatus = null;
  this.icapHeaders = {};
  this.httpMethod = null;
  this.httpHeaders = {};
  this.buffer = null;
};
util.inherits(ICAPResponse, Response);

ICAPResponse.continueEvent = 'continueEvent';

assign(ICAPResponse.prototype, {
  _getCode: function(code, options) {
    code = code || 500;
    options = options || {};
    return [options.version || 'ICAP/1.0', code, codes[code][0]];
  },
  setIcapStatusCode: function(code, options) {
    this.icapStatus = this._getCode(code, options);
  },
  setIcapHeaders: function(headers) {
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
  setFilter: function(isBuffer, filterFn) {
    if (typeof isBuffer === 'function') {
      filterFn = isBuffer;
      isBuffer = false;
    }
    this.buffer = isBuffer ? new Buffer(0) : null;
    this.filter = filterFn;
  },
  _joinHeaders: function (status, headers) {
    var block = status.join(' ') + crlf;
    for (var key in headers) {
      var value = headers[key];
      if (Array.isArray(value)) {
        for (var i = 0, l=value.length; i< l; ++i) {
          block += key + ": " + value[i] + crlf;
        }
      } else {
        block += key + ": " + value + crlf;
      }
    }
    return block;
  },
  writeHeaders: function(hasBody) {
    var headerBlock = '';
    if (!this.icapStatus) {
      // TODO: user should always call setIcapStatusCode(), could throw error
      this.setIcapStatusCode();
    }

    // http status/headers
    if (!!this.httpMethodType) {
      headerBlock = this._joinHeaders(this.httpMethod, this.httpHeaders) + crlf;
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
    }
    this.icapHeaders['Date'] = (new Date()).toGMTString();
    if (!this.icapHeaders['ISTag']) {
      this.icapHeaders['ISTag'] = currentISTag;
    }
    if (!this.icapHeaders['Server']) {
      this.icapHeaders['Server'] = "Nodecap/1.0";
    }

    // icap status/headers
    var icapBlock = this._joinHeaders(this.icapStatus, this.icapHeaders);
    this.stream.write(icapBlock + crlf + headerBlock);
  },
  allowUnchanged: function(icapResponse) {
    if (this.allowUnchangedAllowed) {
      this.setIcapStatusCode(204);
      this.writeHeaders(false);
      this.end();
    }
  },

  continuePreview: function() {
    var code = this._getCode(100);
    this.stream.write(code.join(' ') + crlf + crlf);
  },

  _writeHandyChunk: function(data) {
    // filter output and abort if no response
    // note: this allows filter authors to buffer data internally
    // and call response.send(data) once filter receives a `null`
    if (this.filter) {
      data = this.filter(data);
      if (!data) {
        return;
      }
    }
    // ensure that data is in buffer form for accurate length measurements
    // and to avoid encoding issues when writing
    var tmp = Buffer.isBuffer(data) ? data : new Buffer(data);
    this.stream.write(tmp.length.toString(16) + crlf);
    this.stream.write(tmp);
    this.stream.write(crlf);
  },

  // TODO: more async
  _divideIntoHandyChunks: function(data) {
    var size = this.chunkSize;
    var tmp = data.slice(0, size);
    data = data.slice(size);
    while (tmp.length) {
      this._writeHandyChunk(tmp);
      tmp = data.slice(0, size);
      data = data.slice(size);
    }
  },

  _writeChunk: function(data) {
    if (this.buffer) {
      this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
      return;
    }
    if (data.length > this.chunkSize) {
      return this._divideIntoHandyChunks(data);
    }
    return this._writeHandyChunk(data);
  },

  _streamIsOver: function() {
    // alert the filter that stream is over
    // can return data to write it before the stream is ended
    if (this.filter && this.buffer) {
      var data = this.filter(this.buffer);
      this.filter = null;
      this.buffer = null;
      if (data) {
        this._write(data);
      }
    }
    this.stream.write('0\r\n\r\n');
  },

  _write: function(data) {
    if (data) {
      this._writeChunk(data);
    } else {
      this._streamIsOver();
    }
  },

  send: function(data) {
    this.sendData = data;
  },

  end: function() {
    if (this.done) {
      return;
    }
    if (this.sendData) {
      this._write(this.sendData);
      this._write(null);
      this.sendData = null;
    }
    this.done = true;
  }
});
