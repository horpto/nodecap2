"use strict";

var url = require('url');
var querystring = require('querystring');

//  read from start/0 up to the next newline. returns null if no newline found, else
//  {
//    str: string of the line
//    index: index in buffer of just past the newline
//  }
var readLine = function(buf, start, len) {
  var ix, c, pc;
  start = typeof start !== 'undefined' ? start : 0;
  len = typeof len !== 'undefined' ? len : buf.length;
  for (ix = start; ix < len; ix++) {
    c = String.fromCharCode(buf[ix]);
    if (c === '\n') {
      return {
        str: buf.toString('utf8', start, (pc === '\r') ? (ix - 1) : ix),
        index: ix+1
      };
    }
    pc = c;
  }
  return null;
};

//  read from start/0 up to the next newline and parse as a header: value object.
//  returns null if not valid or:
//  {
//    header: object with {key: value} representing the header
//    index: index in buffer of just past the newline
//  }
var readHeader = function(buf, start, len) {
  var line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  var tokens = line.str.split(':');
  if (tokens.length < 2) {
    return null;
  }
  var header = tokens.shift();
  var value = tokens.join(':');
  if (value.length > 0 && value[0] === ' ') {
    value = value.substr(1)
  }
  var result = {};
  result[header] = value;
  return {
    header: result,
    index: line.index
  };
};

// some urls were not parsing correctly (twitter.com) as they had ports included (twitter.com:443)
// partially copied from isaacs/url-parse-as-address and optimised
var parseUrlOrAddress = function parseUrlOrAddress(uri) {
  var parsed = url.parse(uri, false);
  if (!parsed.slashes) {
    parsed = url.parse('http://' + uri, false);
  } else if (!parsed.protocol) {
    parsed = url.parse('http:' + uri, false);
  }

  parsed.query = querystring.parse(parsed.query);
  return parsed;
}

//  read from start/0 up to the next newline and parse as a HTTP/ICAP method line.
//  returns null if not valid method line or:
//  {
//    method: string of the method eg 'PUT' or 'RESPMOD'
//    url: string of the URI
//    version: string version eg 'ICAP/1.0' or 'HTTP/1.1'
//    index: index in buffer of just past the newline
//  }
var readMethod = function(buf, start, len) {
  var line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  var tokens = line.str.split(' ');
  if (tokens.length < 3) {
    return null;
  }
  var method = tokens.shift();
  var uri = tokens.shift();
  var parsedUri = parseUrlOrAddress(uri);
  var version = tokens.join(' ');
  return {
    method: method,
    uri: uri,
    parsedUri: parsedUri,
    version: version,
    index: line.index
  };
};

var readStatus = function(buf, start, len) {
  var line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  var tokens = line.str.split(' ');
  if (tokens.length < 3) {
    return null;
  }
  var version = tokens.shift();
  var code = tokens.shift();
  var message = tokens.join(' ');
  return {
    version: version,
    code: parseInt(code) || 503,
    message: message,
    index: line.index
  };
};

var readNewline = function(buf, start) {
  if (start < buf.length) {
    var ch2 = buf.toString('utf8', start, start + 2);
    if (ch2 === '\r\n') {
      return {
        newline: true,
        index: start+2
      };
    } else if (ch2.charAt(0) === '\n') {
      return {
        newline: true,
        index: start+1
      };
    }
  }
  return {
    newline: false,
    index: start
  };
};

// Encapsulated: req-hdr=0, res-hdr=137, res-body=296
var encapsulated = function(valStr) {
  if (!valStr) return null;
  var valParts = valStr.split(',');
  var ix;
  var enc = [];
  for (ix = 0; ix < valParts.length; ix++) {
    if (valParts[ix].length > 0 && valParts[ix][0] === ' ') {
      valParts[ix] = valParts[ix].substr(1);
    }
    var valPair = valParts[ix].split('=');
    enc.push([valPair[0], parseInt(valPair[1], 10)]);
  }

  return enc;
};

module.exports = {
  line: readLine,
  header: readHeader,
  method: readMethod,
  status: readStatus,
  newline: readNewline,
  encapsulated: encapsulated
};
