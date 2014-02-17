var util = require('util');
var _ = require('lodash');
var hexy = require('hexy');
var Response = require('./response');
var codes = require('./codes');
var currentISTag = "NODECAP-" + (new Date()).getTime();
var crlf = '\r\n';
var debug = require('optimist').argv.log;

var ICAPResponse = module.exports = function(stream, id) {
  Response.call(this);
  this.stream = stream;
  this.id = id;
  this.protocol = 'ICAP';
  this.done = false;
  this.filter = null;
  this.sendData = null;
  this.allowUnchangedAllowed = true;
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
  setFilter: function(filterFn) {
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
    if (debug) process.stdout.write(this.icapStatus.join(' '));
    stream.write(this.icapStatus.join(' '));
    if (debug) process.stdout.write(crlf);
    stream.write(crlf);
    _.each(this.icapHeaders, function(value, key) {
      if (debug) process.stdout.write(key + ': ' + value + crlf);
      stream.write(key + ': ' + value + crlf);
    }.bind(this));
    if (debug) process.stdout.write(crlf);
    stream.write(crlf);

    if (debug) process.stdout.write(headerBlock);
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
    if (!this.ieof) {
      var code = this._getCode(100);
      if (debug) process.stdout.write(code.join(' '));
      this.stream.write(code.join(' '));
      if (debug) process.stdout.write(crlf);
      this.stream.write(crlf);
      if (debug) process.stdout.write(crlf);
      this.stream.write(crlf);
    }
  },
  _write: function(data) {
    var tmp;
    if (data) {
      if (data.length > 4096) {
        tmp = data.slice(0, 4096);
        data = data.slice(4096);
        while (tmp.length) {
          this._write(tmp);
          tmp = data.slice(0, 4096);
          data = data.slice(4096);
        }
        return;
      }
      if (this.filter) {
        data = this.filter(data);
      }
      // ensure that data is in buffer form for accurate length measurements
      // and to avoid encoding issues when writing
      tmp = data instanceof Buffer ? data : new Buffer(data);
      if (debug) process.stdout.write(hexy.hexy(tmp.length.toString(16) + '\r\n'));
      this.stream.write(tmp.length.toString(16) + '\r\n');
      if (debug) process.stdout.write(hexy.hexy(tmp));
      this.stream.write(tmp);
      if (debug) process.stdout.write(hexy.hexy('\r\n'));
      this.stream.write('\r\n');
    } else {
      if (debug) process.stdout.write(hexy.hexy('0\r\n\r\n'));
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
