"use strict";

var util = require('util');
var _ = require('lodash');
var Response = require('./response');
var codes = require('./codes');
var currentISTag = "NODECAP-" + (new Date()).getTime();
var crlf = '\r\n';

var ICAPResponse = module.exports = function(id, stream, options) {
  Response.call(this);
  this.stream = stream;
  this.id = id;
  this.protocol = 'ICAP';
  this.done = false;
  this.filter = null;
  this.sendData = null;
  this.allowUnchangedAllowed = true;
  this.chunkSize = 'chunkSize' in options ? options.chunkSize : 4096;
  this.icapStatus = null;
  this.icapHeaders = null;
  this.httpMethod = null;
  this.httpHeaders = null;
  this.buffer = null;
};
util.inherits(ICAPResponse, Response);

ICAPResponse.continueEvent = 'continueEvent';

_.extend(ICAPResponse.prototype, {
  _getCode: function(code, options) {
    code = code || 500;
    options = options || {};
    return [options.version || 'ICAP/1.0', code, codes[code][0]];
  },
  setIcapStatusCode: function(code, options) {
    this.icapStatus = this._getCode(code, options);
  },
  setIcapHeaders: function(headers) {
    this.icapHeaders = _.extend(this.icapHeaders || {}, headers);
  },
  setHttpMethod: function(options) {
    this.httpMethodType = 'request';
    this.httpMethod = [options.method, options.uri, options.version || 'HTTP/1.1'];
  },
  setHttpStatus: function(code, options) {
    if (_.isObject(code)) {
      options = code;
      code = options.code || null;
    }
    options = options || {};
    options.version = options.version || 'HTTP/1.1';
    this.httpMethodType = 'response';
    this.httpMethod = this._getCode(code, options);
  },
  setHttpHeaders: function(headers) {
    this.httpHeaders = _.extend(this.httpHeaders || {}, headers);
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
  writeHeaders: function(hasBody) {
    var stream = this.stream;
    var headerBlock = '';
    if (!this.icapStatus) {
      // TODO: user should always call setIcapStatusCode(), could throw error
      this.setIcapStatusCode();
    }
    this.icapHeaders = this.icapHeaders || {};

    // http status/headers
    if (!!this.httpMethodType) {
      headerBlock += this.httpMethod.join(' ') + crlf;
      _.each(this.httpHeaders || {}, function(value, key) {
        headerBlock += key + ': ' + value + crlf;
      });
      headerBlock += crlf;

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
    stream.write(this.icapStatus.join(' '));
    stream.write(crlf);
    _.each(this.icapHeaders, function(value, key) {
      stream.write(key + ': ' + value + crlf);
    }.bind(this));
    stream.write(crlf);

    stream.write(headerBlock);
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
    this.stream.write(code.join(' '));
    this.stream.write(crlf);
    this.stream.write(crlf);
  },
  _write: function(data) {
    var tmp;
    if (data) {
      if (this.buffer) {
        this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
        return;
      }
      if (this.chunkSize && data.length > this.chunkSize) {
        var size = this.chunkSize; // 4096 bytes by default
        tmp = data.slice(0, size);
        data = data.slice(size);
        while (tmp.length) {
          this._write(tmp);
          tmp = data.slice(0, size);
          data = data.slice(size);
        }
        return;
      }
      // filter output and abort if no reponse
      // note: this allows filter authors to buffer data internally
      // and call response.send(data) once filter receives a `null`
      if (this.filter) {
        data = this.filter(data);
      }
      // ensure that data is in buffer form for accurate length measurements
      // and to avoid encoding issues when writing
      tmp = data instanceof Buffer ? data : new Buffer(data);
      this.stream.write(tmp.length.toString(16) + '\r\n');
      this.stream.write(tmp);
      this.stream.write('\r\n');
    } else {
      // alert the filter that stream is over
      // can return data to write it before the stream is ended
      if (this.filter && this.buffer) {
        data = this.filter(this.buffer);
        this.filter = null;
        this.buffer = null;
        this._write(data);
      }
      this.stream.write('0\r\n\r\n');
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
