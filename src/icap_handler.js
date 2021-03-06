'use strict';

const ICAPError = require('./icap_error');
const ICAPRequest = require('./icap_request');
const ICAPResponse = require('./icap_response');
const HTTPRequest = require('./http_request');
const HTTPResponse = require('./http_response');
const helpers = require('./helpers');

const states = {
  'icapmethod': 'icapmethod',
  'icapheader': 'icapheader',
  'requestmethod': 'requestmethod',
  'requestheader': 'requestheader',
  'responseversion': 'responseversion',
  'responseheader': 'responseheader',
  'parsepreview': 'parsepreview',
  'parsebody': 'parsebody'
};

let icapHandlerCount = 1;

/*
 *  ICAPHandler
 *    Encapsulates handling of an ICAP client request.
 */
module.exports = class ICAPHandler {
  constructor(socket, emitter, options) {
    this.handlerCount = '' + icapHandlerCount++;
    this.currentQuery = 0;
    this.id = '';
    this.emitter = emitter;
    this.socket = socket;
    this.logger = options.logger;
    this.options = options;
    this.buffer = new Buffer(0);

    this.clearState();
    this.initialize();
  }

  initialize() {
    const socket = this.socket;
    socket.setTimeout(0);

    socket.on('connect', () => {
      this.logger.debug('[%s] socket connect', this.id);
      this.emitEvent('connect');
    });

    socket.on('data', (data) => {
      if (this.buffer.length === 0) {
        this.buffer = data;
      } else {
        this.buffer = Buffer.concat([this.buffer, data], this.buffer.length + data.length);
      }
      this.nextState();
    });

    socket.on('end', () => {
      this.logger.debug('[%s] socket end', this.id);
      this.emitEvent('closed');
      socket.destroy();
    });

    socket.on('timeout', () => {
      this.logger.debug('[%s] socket timeout', this.id);
    });

    socket.on('close', () => {
      this.logger.debug('[%s] socket close', this.id);
    });

    socket.on('error', (err) => {
      this.logger.error('[%s] socket error "%s"', this.id, err.message || 'Unknown Error');

      // notify the error handler not to process the response further
      if (this.icapResponse) {
        this.icapResponse.done = true;
      }
      this.emitError(err);
      socket.destroy();
    });
  }

  emitEvent(eventName) {
    this.emitter.emit(eventName, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  }

  emitError(err) {
    this.emitter.emit('error', err, this.icapRequest, this.icapResponse, this.httpRequest, this.httpResponse);
  }

  resetState() {
    this.emitEvent('end');
    this.logger.debug('[%s] handler resetState', this.id);
    if (this.icapRequest) {
      this.icapRequest.removeAllListeners();
    }

    this.buffer = this.buffer.slice(this.bufferIndex, this.buffer.length);
    this.clearState();
    this.nextState();
  }

  clearState() {
    this.id = `${process.pid}:${this.handlerCount}:${this.currentQuery++}`;
    this.state = states.icapmethod;
    this.icapRequest = new ICAPRequest(this.id);
    this.icapResponse = new ICAPResponse(this.id, this.socket, this.options);
    this.httpRequest = new HTTPRequest();
    this.httpResponse = new HTTPResponse();
    this.chunkSize = null;
    this.previewBuffer = null;
    this.parsePreview = false;
    this.bufferIndex = 0;
    this.icapBodyStartIndex = 0;
    this.waitOffset = 0;
  }

  changeState(newState, offset) {
    this.state = newState;
    if (typeof offset === 'number') {
      this.waitOffset = offset + this.icapBodyStartIndex;
    }
    this.nextState();
  }

  nextState() {
    if (!this.nextIfNotDone()) {
      return;
    }
    if (this.waitOffset <= this.buffer.length) {
      try {
        this[this.state]();
      } catch (err) {
        this.emitError(err);
        this.socket.destroy();
      }
    }
  }

  nextIfNotDone() {
    if (this.icapResponse.done) {
      this.resetState();
      return false;
    }
    return true;
  }

  nextStateEncapsulated() {
    if (!this.nextIfNotDone()) {
      return;
    }
    const encapsulated = this.icapRequest.encapsulated;
    const encapsulatedEntity = encapsulated.shift();
    switch (encapsulatedEntity[0]) {
    case 'req-hdr':
      if (!encapsulated.length) {
        throw new ICAPError('No body offset for req-hdr');
      }
      this.changeState(states.requestheader, encapsulated[0][1]);
      break;
    case 'res-hdr':
      if (!encapsulated.length) {
        throw new ICAPError('No body offset for res-hdr');
      }
      this.changeState(states.responseheader, encapsulated[0][1]);
      break;
    case 'req-body':
    case 'res-body':
      if (this.parsePreview) {
        encapsulated.unshift(encapsulatedEntity);
        this.changeState(states.parsepreview);
        break;
      }

      this.emitEvent(this.icapRequest.isReqMod() ? 'httpRequestBody' : 'httpResponseBody');
      this.changeState(states.parsebody, 0);
      break;
    case 'null-body':
      this.emitEvent(this.icapRequest.isReqMod() ? 'httpRequestNullBody' : 'httpResponseNullBody');
      this.logger.debug('[%s] null-body]', this.id);
      this.icapRequest.push(null);
      this.resetState();
      break;
    default:
      throw new ICAPError(`Unsupported encapsulated entity: ${encapsulatedEntity}`);
    }
  }

  read(helperMethod) {
    const result = helperMethod(this.buffer, this.bufferIndex);
    if (result && typeof result.index === 'number') {
      this.bufferIndex = result.index;
      delete result.index;
    }
    return result;
  }

  readChunk() {
    if (!this.chunkSize) {
      const line = this.read(helpers.line);
      if (!line || !line.str.length) {
        return null;
      }

      const arr = line.str.split(';');
      const chunkSize = parseInt(arr[0], 16);
      if (isNaN(chunkSize)) {
        throw new ICAPError(`Cannot read chunk size ${line.str}`);
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
      const data = this.buffer.slice(this.bufferIndex, this.bufferIndex + this.chunkSize);
      this.bufferIndex += this.chunkSize + 2; // skip CRLF
      this.chunkSize = null;
      return {
        data
      };
    }
    return null;
  }

  readAllHeaders() {
    let header;
    const headers = {};
    while ((header = this.read(helpers.header)) !== null) {
      const headerName = header.header;
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
  }

  icapmethod() {
    const method = this.read(helpers.method);
    if (!method) {
      return;
    }
    this.icapRequest.setMethod(method);

    this.logger.verbose('[%s] icapmethod:', this.id, method.line);
    this.emitEvent('icapMethod');
    this.changeState(states.icapheader);
  }

  icapheader() {
    const headers = this.readAllHeaders();
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
      break;

    case 'RESPMOD':
    case 'REQMOD':
      this.icapRequest.encapsulated = helpers.encapsulated(this.icapRequest.headers['Encapsulated']);
      if (!this.icapRequest.encapsulated || !this.icapRequest.encapsulated.length) {
        throw new ICAPError(`Missing Encapsulated header for: ${this.icapRequest.method}`);
      }
      if (this.icapRequest.hasPreviewBody()) {
        this.parsePreview = true;
      }
      this.nextStateEncapsulated();
      break;

    default:
      throw new ICAPError(405);
    }
  }

  requestheader() {
    const method = this.read(helpers.method);
    if (!method) {
      throw new ICAPError('Request method not found');
    }
    this.httpRequest.setMethod(method);

    const headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Request headers not found');
    }
    this.httpRequest.setHeaders(headers);
    this.logger.verbose('[%s] HTTP Req method: %s, headers: %j', this.id, method.line, headers, '');
    if (this.icapRequest.isReqMod() && !this.parsePreview) {
      this.emitEvent('httpRequest');
    }
    this.nextStateEncapsulated();
  }

  responseheader() {
    const status = this.read(helpers.status);
    if (!status) {
      throw new ICAPError('Response method not found');
    }
    Object.assign(this.httpResponse, status);

    const headers = this.readAllHeaders();
    if (!headers) {
      throw new ICAPError('Response headers not found');
    }
    this.httpResponse.setHeaders(headers);
    this.logger.verbose('[%s] HTTP Res status: %s headers: %j', this.id, status.line, headers, '');
    if (this.icapRequest.isRespMod() && !this.parsePreview) {
      this.emitEvent('httpResponse');
    }
    this.nextStateEncapsulated();
  }

  parsepreview() {
    if (!this.previewBuffer) {
      this.previewBuffer = new Buffer(0);
    }
    let body;
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
  }

  parsebody() {
    if (this.previewBuffer) {
      this.logger.debug('[%s] parsebody preview chunk length %s', this.id, this.previewBuffer.length);
      this.icapRequest.push(this.previewBuffer);
      this.previewBuffer = null;
    }
    if (this.icapRequest.ieof) {
      this.icapRequest.push(null);
      this.resetState();
      return;
    }
    let body;
    while ((body = this.readChunk()) !== null) {
      if (body.data) {
        this.logger.debug('[%s] parsebody chunk length %s', this.id, body.data.length);
        this.icapRequest.push(body.data);
      }
      if (body.eof) {
        this.logger.debug('[%s] parsebody eof', this.id);
        this.icapRequest.push(null);
        this.resetState();
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
