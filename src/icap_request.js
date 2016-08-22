'use strict';

const EventEmitter = require('eventemitter3');
const Request = require('./request');

let magic = null;

try {
  const mmm = require('mmmagic');
  magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
} catch (err) {
  console.warn('Can not import mmmagic');
}

class ICAPRequest extends Request {
  constructor(id) {
    super();
    EventEmitter.call(this);

    this.id = id;
    this.stream = null;
    this.isPrevVersionProto = false;
    this.preview = null;
    this.ieof = false;
    this.done = false;
  }

  push(data) {
    if (!this.stream) {
      // icapReq now are closed;
      if (data == null) {
        this.done = true;
      }
      return;
    }
    if (this.isPrevVersionProto) {
      return this.stream._write(data);
    }
    if (data) {
      return this.stream.write(data);
    }
    return this.stream.end();
  }

  pipe(stream) {
    this.stream = stream;
    this.isPrevVersionProto = stream.write == null;
    // icapReq are closed already thus we'are closing stream.
    if (this.done) {
      this.push(null);
    }
  }

  hasPreview() {
    return this.headers && 'Preview' in this.headers;
  }

  hasBody() {
    if (!this.encapsulated || !this.encapsulated.length) {
      return null;
    }
    return this.encapsulated[this.encapsulated.length - 1][0] !== 'null-body';
  }

  hasPreviewBody() {
    return this.hasPreview() && this.hasBody();
  }

  isReqMod() {
    return this.method === 'REQMOD';
  }

  isRespMod() {
    return this.method === 'RESPMOD';
  }

  isOptions() {
    return this.method === 'OPTIONS';
  }

  getPreviewMime(cb) {
    if (!this.preview) {
      return cb(null, null);
    }
    if (magic != null) {
      return magic.detect(this.preview, cb);
    }
    return cb(new Error("'mmmagic' not loaded"), null);
  }
}
module.exports = ICAPRequest;

Object.assign(ICAPRequest.prototype, EventEmitter.prototype);
