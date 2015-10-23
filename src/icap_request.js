var util = require('util');
var _ = require('lodash');
var Request = require('./request');
var mmm = require('mmmagic');

var magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);

var ICAPRequest = module.exports = function(id) {
  Request.call(this);
  this.id = id;
  this.stream = null;
  this.preview = null;
  this.ieof = false;
};
util.inherits(ICAPRequest, Request);

_.extend(ICAPRequest.prototype, {
  push: function(data) {
    if (this.stream) {
      this.stream._write(data);
    }
  },
  pipe: function(stream) {
    this.stream = stream;
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
      cb(null, null);
      return;
    }
    magic.detect(this.preview, cb);
  }
});
