"use strict";

var ICAPError = require('./icap_error');
var ICAPRequest = require('./icap_request');
var ICAPResponse = require('./icap_response');
var HTTPRequest = require('./http_request');
var HTTPResponse = require('./http_response');
var helpers = require('./helpers');

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

var icapHandlerCount = 1;

/*
 *  ICAPHandler
 *    Encapsulates handling of an ICAP client request.
 */
function ICAPHandler(socket, emitter, options) {
  this.handlerCount = '' + icapHandlerCount++;
  this.currentQuery = 0;
  this.id = '';
  this.emitter = emitter;
  this.socket = socket;
  this.logger = options.logger;
  this.options = options;
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
    var self = this;
    var socket = this.socket;
    socket.setTimeout(0);

    socket.on('connect', function() {
      self.logger.debug('[%s] socket connect', self.id);
      self.emitEvent('connect');
    });

    socket.on('data', function(data) {
      if (self.buffer.length === 0) {
        self.buffer = data;
      } else {
        self.buffer = Buffer.concat([self.buffer, data], self.buffer.length + data.length);
      }
      self.nextState();
    });

    socket.on('end', function() {
      self.logger.debug('[%s] socket end', self.id);
      self.emitEvent('closed');
      socket.destroy();
    });

    socket.on('timeout', function() {
      self.logger.debug('[%s] socket timeout', self.id);
    });

    socket.on('close', function() {
      self.logger.debug('[%s] socket close', self.id);
    });

    socket.on('error', function(err) {
      self.logger.error('[%s] socket error "%s"', self.id, err.message || 'Unknown Error');

      // notify the error handler not to process the response further
      if (self.icapResponse) {
        self.icapResponse.done = true;
      }
      self.emitError(err);
      socket.destroy();
    });
  },

  emitEvent: function(eventName) {
    this.emitter.emit(eventName, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  },

  emitError: function(err) {
    this.emitter.emit('error', err, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  },

  resetState: function(isFirstReset) {
    if (!isFirstReset) {
      this.emitEvent('end');
      this.logger.debug('[%s] handler resetState', this.id);
    }
    if (this.icapRequest) {
      this.icapRequest.removeAllListeners();
    }
    this.id = process.pid + ':' + this.handlerCount + ':' + this.currentQuery++;
    this.state = states.icapmethod;
    this.icapRequest = new ICAPRequest(this.id);
    this.icapResponse = new ICAPResponse(this.id, this.socket, this.options);
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

  nextState: function(state, offset) {
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
        this.socket.destroy();
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
      this.logger.debug('[%s] null-body]', this.id);
      this.icapRequest.push(null);
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
      if (arr.length > 1 && arr[1] === ' ieof') {
        // assert chunkSize === 0
        this.icapRequest.ieof = true;
        this.bufferIndex += arr[1].length;
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
      var headerName = header.header;
      if (headerName in headers) {
        if (!Array.isArray(headers[headerName])) {
          headers[headerName] = [headers[headerName]];
        }
        headers[headerName].push(header.value);
      } else {
        headers[headerName] = header.value;
      }

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

    this.logger.verbose('[%s] icapmethod:', this.id, method.line);
    this.emitEvent('icapMethod');
    this.nextState(states.icapheader);
  },

  icapheader: function() {
    var headers = this.readAllHeaders();
    if (!headers) {
      this.logger.warn('[%s] icapheader - no headers!', this.id);
      return;
    }
    this.icapRequest.setHeaders(headers);
    this.logger.verbose('[%s] icapheader %j', this.id, this.icapRequest.headers, '');
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
    this.httpRequest.setMethod(method);

    var headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Request headers not found');
    }
    this.httpRequest.setHeaders(headers);
    this.logger.verbose('[%s] HTTP Req method: %s, headers: %j', this.id, method.line, headers, '');
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
    Object.assign(this.httpResponse, status);

    var headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Response headers not found');
    }
    this.httpResponse.setHeaders(headers);
    this.logger.verbose('[%s] HTTP Res status: %s headers: %j', this.id, status.line, headers, '');
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
        if (this.previewBuffer.length === 0) {
          this.previewBuffer = null;
        }
        this.parsePreview = false;
        this.state = states.parsebody;
        if (this.icapRequest.isReqMod()) {
          this.emitEvent('httpRequest');
        } else {
          this.emitEvent('httpResponse');
        }
        if (this.icapRequest.ieof) {
          // User can't initiate new data transfer by continuePreview();
          // In absense of new data on wire nothing will trigger
          // futher processing, therefore only we can initiate
          // completion of the request processing:
          this.nextState(); // the parsebody state installed above
          return;
        }
      }
    }
  },

  parsebody: function() {
    var body;
    if (this.previewBuffer) {
      this.logger.debug('[%s] parsebody preview chunk length %s', this.id, this.previewBuffer.length);
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
        this.logger.debug('[%s] parsebody chunk length %s', this.id, body.data.length);
        this.icapRequest.push(body.data);
      }
      if (body.eof) {
        this.logger.debug('[%s] parsebody eof', this.id);
        this.icapRequest.push(null);
        this.resetState();
        this.nextState();
        break;
      }
    }

    if (this.bufferIndex != 0) {
      this.buffer = this.buffer.slice(this.bufferIndex);
      this.bufferIndex = 0;
      this.waitOffset = 0;
    }
  }
};

module.exports = ICAPHandler;
