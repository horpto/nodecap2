var net = require('net');
var url = require('url');
var util = require('util');
var _ = require('lodash');
var hexy = require('hexy');

var ICAPError = require('./icap_error');
var ICAPRequest = require('./icap_request');
var ICAPResponse = require('./icap_response');
var HTTPRequest = require('./http_request');
var HTTPResponse = require('./http_response');
var helpers = require('./helpers');
var codes = require('./codes');

var states = {
  'icapmethod': 'icapmethod',
  'icapheader': 'icapheader',
  'requestmethod': 'requestmethod',
  'requestheader': 'requestheader',
  'responseversion': 'responseversion',
  'responseheader': 'responseheader',
  'parsepreview': 'parsepreview',
  'parsebody': 'parsebody'
};

/*
 *  ICAPHandler
 *    Encapsulates handling of an ICAP client request.
 */
function ICAPHandler(socket, emitter, options) {
  options = options || {};
  this.emitter = emitter;
  this.socket = socket;
  this.options = options;
  this.debug = !!options.debug;
  this.buffer = new Buffer(0);
  this.bufferIndex = 0;
  this.icapBodyStartIndex = 0;
  this.waitOffset = 0;

  this.resetState(true);
  this.initialize();
}

ICAPHandler.prototype = {
  constructor: ICAPHandler,

  initialize: function() {
    var socket = this.socket;
    socket.setTimeout(0);

    socket.on('connect', function() {
      if (this.debug) console.log(this.id, '[socket:connect]');
      this.emitEvent('connnect');
    }.bind(this));

    socket.on('data', function(data) {
      this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
      this.nextState();
    }.bind(this));

    socket.on('end', function() {
      if (this.debug) console.log(this.id, '[socket:end]');
      this.emitEvent('closed');
      socket.end();
    }.bind(this));

    socket.on('timeout', function() {
      if (this.debug) console.log(this.id, '[socket:timeout]');
    })

    socket.on('close', function() {
      if (this.debug) console.log(this.id, '[socket:close]');
    });

    socket.on('error', function(err) {
      if (this.debug) console.error(this.id, '[socket:error]', err);

      // notify the error handler not to process the response further
      if (this.icapResponse) {
        this.icapResponse.done = true;
      }
      this.emitError(err);
      socket.end();
    }.bind(this));
  },

  emitEvent: function(eventName) {
    this.emitter.emit(eventName, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  },

  emitError: function(err) {
    this.emitter.emit('error', err, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  },

  resetState :function(isFirstReset) {
    if (!isFirstReset) {
      this.emitEvent('end');
      if (this.debug) console.log('resetState');
    }
    if (this.icapRequest) {
      this.icapRequest.removeAllListeners();
    }
    var id = _.uniqueId();
    this.id = id;
    this.state = states.icapmethod;
    this.icapRequest = new ICAPRequest(this.id);
    this.icapResponse = new ICAPResponse(this.options.responseStream || this.socket, this.id);
    this.httpRequest = new HTTPRequest();
    this.httpResponse = new HTTPResponse();

    if (!isFirstReset) {
      this.buffer = this.buffer.slice(this.bufferIndex, this.buffer.length);
      this.bufferIndex = 0;
      this.icapBodyStartIndex = 0;
      this.waitOffset = 0;
    }
    this.chunkSize = null;
    this.previewBuffer = null;
    this.parsePreview = false;
  },

  nextState : function(state, offset) {
    if (!this.nextIfNotDone()) {
      return;
    }
    if (typeof state !== 'undefined' && state !== null) {
      this.state = state;
    }
    if (typeof offset === 'number') {
      this.waitOffset = offset + this.icapBodyStartIndex;
    }
    if (this.waitOffset <= this.buffer.length) {
      try {
        this[this.state]();
      } catch (err) {
        this.emitError(err);
        this.socket.end();
      }
    }
  },

  nextIfNotDone: function() {
    if (this.icapResponse.done) {
      this.resetState();
      this.nextState();
      return false;
    }
    return true;
  },

  nextStateEncapsulated: function() {
    var encapsulatedEntity;
    if (!this.nextIfNotDone()) {
      return;
    }
    encapsulatedEntity = this.icapRequest.encapsulated.shift();
    switch (encapsulatedEntity[0]) {
      case 'req-hdr':
        if (!this.icapRequest.encapsulated.length) {
          throw new ICAPError('No body offset for req-hdr');
        }
        this.nextState(states.requestheader, this.icapRequest.encapsulated[0][1]);
        break;
      case 'res-hdr':
        if (!this.icapRequest.encapsulated.length) {
          throw new ICAPError('No body offset for res-hdr');
        }
        this.nextState(states.responseheader, this.icapRequest.encapsulated[0][1]);
        break;
      case 'req-body':
      case 'res-body':
        if (this.parsePreview) {
          this.icapRequest.encapsulated.unshift(encapsulatedEntity);
          this.nextState(states.parsepreview);
          break;
        }

        this.emitEvent(this.icapRequest.isReqMod() ? 'httpRequestBody' : 'httpResponseBody');
        this.nextState(states.parsebody, 0);
        break;
      case 'null-body':
        this.emitEvent(this.icapRequest.isReqMod() ? 'httpRequestNullBody' : 'httpResponseNullBody');
        if (this.debug) console.log('null-body');
        this.icapResponse.end();
        this.resetState();
        this.nextState();
        break;
      default:
        throw new ICAPError('Unsupported encapsulated entity: ' + encapsulatedEntity);
    }
  },

  read: function(helperMethod) {
    var result = helperMethod(this.buffer, this.bufferIndex);
    if (result && typeof result.index === 'number') {
      this.bufferIndex = result.index;
      delete result.index;
    }
    return result;
  },

  readChunk: function() {
    if (!this.chunkSize) {
      var line;
      line = this.read(helpers.line);
      if (!line || !line.str.length) {
        return null;
      }

      var arr = line.str.split(';');
      var chunkSize = parseInt(arr[0], 16);
      if (isNaN(chunkSize)) {
        throw new ICAPError('Cannot read chunk size' + line.str);
      }
      this.chunkSize = chunkSize;
      if (arr.length > 1 && arr[1] === 'ieof') {
        this.icapRequest.ieof = true;
      }
      if (chunkSize === 0) {
        this.bufferIndex += 2; // skip last CRLF
        return {data: null, eof: true};
      }
    }
    if (this.bufferIndex + this.chunkSize < this.buffer.length) {
      var data = this.buffer.slice(this.bufferIndex, this.bufferIndex + this.chunkSize);
      this.bufferIndex += this.chunkSize + 2; // skip CRLF
      this.chunkSize = null;
      return {
        data: data
      };
    }
    return null;
  },

  readAllHeaders: function() {
    var header = null;
    var headers = {};
    while ((header = this.read(helpers.header)) !== null) {
      _.extend(headers, header.header);

      if (this.read(helpers.newline).newline) {
        return headers;
      }
    }
    if (this.read(helpers.newline).newline) {
      return headers;
    }
    return null;
  },

  icapmethod: function() {
    var method = this.read(helpers.method);
    if (!method) {
      return;
    }
    this.icapRequest.setMethod(method);

    if (this.debug) console.log(this.id, '[icapMethod] ', JSON.stringify(method));
    this.emitEvent('icapMethod');
    this.nextState(states.icapheader);
  },

  icapheader: function() {
    var headers = this.readAllHeaders();
    if (!headers) {
      if (this.debug) console.log(this.id, 'No headers WTF?');
      return;
    }
    this.icapRequest.setHeaders(headers);
    if (this.debug) console.log(this.id, '[icapHeaders] ', JSON.stringify(this.icapRequest.headers));
    this.emitEvent('icapHeaders');
    this.icapBodyStartIndex = this.bufferIndex;

    switch (this.icapRequest.method) {
      case 'OPTIONS':
        this.emitEvent('icapOptions');
        this.resetState();
        this.nextState();
        break;

      case 'RESPMOD':
      case 'REQMOD':
        this.icapRequest.encapsulated = helpers.encapsulated(this.icapRequest.headers['Encapsulated']);
        if (!this.icapRequest.encapsulated || !this.icapRequest.encapsulated.length) {
          throw new ICAPError('Missing Encapsulated header for: ' + this.icapRequest.method);
        }
        if (this.icapRequest.hasPreviewBody()) {
          this.parsePreview = true;
        }
        this.nextStateEncapsulated();
        break;

      default:
        throw new ICAPError(405);
    }
  },

  requestheader: function() {
    var method = this.read(helpers.method);
    if (!method) {
      throw new ICAPError('Request method not found');
    }
    _.extend(this.httpRequest, method);

    var headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Request headers not found');
    }
    this.httpRequest.setHeaders(headers);
    if (this.debug) console.log(this.id, '[requestheader] ', JSON.stringify(this.httpRequest));
    if (this.icapRequest.isReqMod() && !this.parsePreview) {
      this.emitEvent('httpRequest');
    }
    this.nextStateEncapsulated();
  },

  responseheader: function() {
    var status = this.read(helpers.status);
    if (!status) {
      throw new ICAPError('Response method not found');
    }
    _.extend(this.httpResponse, status);

    var headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Response headers not found');
    }
    this.httpResponse.setHeaders(headers);
    if (this.debug) console.log(this.id, '[responseheader] ', JSON.stringify(this.httpResponse));
    if (this.icapRequest.isRespMod() && !this.parsePreview) {
      this.emitEvent('httpResponse');
    }
    this.nextStateEncapsulated();
  },

  parsepreview: function() {
    var body;
    if (!this.previewBuffer) {
      this.previewBuffer = new Buffer(0);
    }
    while ((body = this.readChunk()) !== null) {
      if (body.data) {
        this.previewBuffer = Buffer.concat([this.previewBuffer, body.data], this.previewBuffer.length + body.data.length);
      }
      if (body.eof) {
        this.icapRequest.preview = this.previewBuffer;
        this.parsePreview = false;
        this.state = states.parsebody;
        if (this.debug) console.log(this.id, '[preview]\n' + hexy.hexy(this.previewBuffer));
        if (this.icapRequest.isReqMod()) {
          this.emitEvent('httpRequest');
        } else {
          this.emitEvent('httpResponse');
        }
      }
    }
  },

  parsebody: function() {
    var body;
    if (this.previewBuffer) {
      if (this.debug) console.log(this.id, '[preview -> body]\n' + hexy.hexy(this.previewBuffer));
      this.icapRequest.push(this.previewBuffer);
      this.previewBuffer = null;
    }
    if (this.icapRequest.ieof) {
      this.icapRequest.push(null);
      this.resetState();
      this.nextState();
      return;
    }
    while ((body = this.readChunk()) !== null) {
      if (body.data) {
        if (this.debug) console.log(this.id, '[body]\n' + hexy.hexy(body.data));
        this.icapRequest.push(body.data);
      }
      if (body.eof) {
        if (this.debug) console.log('parsebody:eof');
        this.icapRequest.push(null);
        this.icapResponse.end();
        this.resetState();
        this.nextState();
        break;
      }
    }
  }
};

module.exports = ICAPHandler;
