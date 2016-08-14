"use strict";

var util = require('util');
var EventEmitter = require('eventemitter3');
var Request = require('./request');
var assign = require('./utils').assign;

var magic = null;

try {
  var mmm = require('mmmagic');
  magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
} catch (err) {
  console.warn('Can not import mmmagic');
}

var ICAPRequest = module.exports = function(id) {
  Request.call(this);
  EventEmitter.call(this);

  this.id = id;
  this.stream = null;
  this.isPrevVersionProto = false;
  this.preview = null;
  this.ieof = false;
};
util.inherits(ICAPRequest, EventEmitter);

assign(ICAPRequest.prototype, Request.prototype, {
  push: function(data) {
    if (!this.stream) {
      return;
    }
    if (this.isPrevVersionProto) {
      return this.stream._write(data);
    }
    if (data) {
      return this.stream.write(data);
    }
    return this.stream.end();
  },
  pipe: function(stream) {
    this.stream = stream;
    this.isPrevVersionProto = stream.write == null;
  },
  hasPreview: function() {
    return this.headers && 'Preview' in this.headers;
  },
  hasBody: function() {
    if (!this.encapsulated || !this.encapsulated.length) {
      return null;
    }
    return this.encapsulated[this.encapsulated.length - 1][0] !== 'null-body';
  },
  hasPreviewBody: function() {
    return this.hasPreview() && this.hasBody();
  },
  isReqMod: function() {
    return this.method === 'REQMOD';
  },
  isRespMod: function() {
    return this.method === 'RESPMOD';
  },
  isOptions: function() {
    return this.method === 'OPTIONS';
  },
  getPreviewMime: function(cb) {
    if (!this.preview) {
      return cb(null, null);;
    }
    if (magic != null) {
      return magic.detect(this.preview, cb);
    }
    return cb(new Error("'mmmagic' not loaded"), null);
  }
});
