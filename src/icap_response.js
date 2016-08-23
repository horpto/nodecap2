'use strict';

const util = require('util');
const Transform = require('stream').Transform;
const Response = require('./response');
const codes = require('./codes');
const currentISTag = `NODECAP-${(new Date()).getTime()}`;

const crlf = '\r\n';
const DEFAULT_CHUNK_SIZE = 4096;

class ICAPResponse extends Response {
  constructor(id, stream, options) {
    super('ICAP');

    options = Object.assign(options || {}, {
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
  }

  _getCode(code, options) {
    code = code || 500;
    options = options || {};
    return [options.version || 'ICAP/1.0', code, codes[code][0]];
  }
  setIcapStatusCode(code, options) {
    this.icapStatus = this._getCode(code, options);
  }
  setIcapHeaders(headers) {
    // TODO: filter headers???
    this.icapHeaders = Object.assign(this.icapHeaders, headers);
  }
  setHttpMethod(options) {
    this.httpMethodType = 'request';
    this.httpMethod = [options.method, options.uri, options.version || 'HTTP/1.1'];
  }
  setHttpStatus(code, options) {
    if (typeof code === 'object') {
      options = code;
      code = options.code || null;
    }
    options = options || {};
    options.version = options.version || 'HTTP/1.1';
    this.httpMethodType = 'response';
    this.httpMethod = this._getCode(code, options);
  }

  setHttpHeaders(headers) {
    this.httpHeaders = Object.assign(this.httpHeaders, headers);
  }

  hasFilter() {
    return typeof this.filter === 'function';
  }

  setFilter(callAtEnd, filterFn) {
    if (typeof callAtEnd === 'function') {
      filterFn = callAtEnd;
      callAtEnd = false;
    }
    this.buffer = callAtEnd ? new Buffer(0) : null;
    this.filter = filterFn;
  }

  _joinHeaders(status, headers) {
    let block = status.join(' ') + crlf;
    for (let key in headers) {
      const value = headers[key];
      key += ': ';
      if (Array.isArray(value)) {
        for (let i = 0, l=value.length; i < l; ++i) {
          block += key + value[i] + crlf;
        }
      } else {
        block += key + value + crlf;
      }
    }
    return block;
  }

  _setEncapsulatedHeader(hasBody, headerBlock) {
    const encapsulated = [];
    let bodyType = 'null-body';
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

  _checkDefaultIcapHeaders() {
    this.icapHeaders['Date'] = (new Date()).toGMTString();
    if (!this.icapHeaders['ISTag']) {
      this.icapHeaders['ISTag'] = currentISTag;
    }
    if (!this.icapHeaders['Server']) {
      this.icapHeaders['Server'] = 'Nodecap/1.0';
    }
  }

  writeHeaders(hasBody) {
    this.hasBody = hasBody;

    if (!this.icapStatus) {
      // TODO: user should always call setIcapStatusCode(), could throw error
      this.setIcapStatusCode();
    }
    // http status/headers
    let headerBlock = '';
    if (this.httpMethodType) {
      headerBlock = this._joinHeaders(this.httpMethod, this.httpHeaders) + crlf;
      this._setEncapsulatedHeader(hasBody, headerBlock);
    }
    // icap status/headers
    this._checkDefaultIcapHeaders();
    const icapBlock = this._joinHeaders(this.icapStatus, this.icapHeaders);
    this.push(icapBlock + crlf + headerBlock);
  }

  allowUnchanged() {
    // user should check status 204 is allowed own
    this.setIcapStatusCode(204);
    this.writeHeaders(false);
    this.end();
  }

  continuePreview() {
    const code = this._getCode(100);
    this.push(code.join(' ') + crlf + crlf);
  }

  _writeHandyChunk(data) {
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
  }

  // TODO: more async
  _divideIntoHandyChunks(data, cb) {
    const size = this.chunkSize;
    let tmp = data.slice(0, size);
    data = data.slice(size);
    while (tmp.length) {
      this._writeHandyChunk(tmp);
      tmp = data.slice(0, size);
      data = data.slice(size);
    }
    return cb();
  }

  _writeChunk(data, cb) {
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
  }

  // alert the filter that stream is over
  // can return data to write it before the stream is ended
  _streamIsOver() {
    if (this.filter && this.buffer) {
      const data = this.filter(this.buffer);
      this.filter = null;
      this.buffer = null;
      if (data) {
        this.write(data);
      }
    }
    this.push('0\r\n\r\n');
  }

  _transform(data, _, cb) {
    // not write null chunks because they signal about end of stream
    if (data.length) {
      return this._writeChunk(data, cb);
    }
    return cb();
  }

  send(data) {
    this.sendData = data;
  }

  _flush(cb) {
    if (this.hasBody) {
      if (this.sendData) {
        this.write(this.sendData);
        this.sendData = null;
      }
      this._streamIsOver();
    }
    this.done = true;
    this.unpipe();
    cb();
  }
}

util.inherits(ICAPResponse, Transform);
module.exports = ICAPResponse;
