'use strict';

const url = require('url');
const querystring = require('querystring');

//  read from start/0 up to the next newline. returns null if no newline found, else
//  {
//    str: string of the line
//    index: index in buffer of just past the newline
//  }
const readLine = function(buf, start, len) {
  /*eslint no-var: 'off'*/
  start = typeof start !== 'undefined' ? start : 0;
  len = typeof len !== 'undefined' ? len : buf.length;
  for (var ix = start; ix < len; ix++) {
    if (String.fromCharCode(buf[ix]) === '\n') {
      return {
        str: buf.toString('utf8',
          start,
          (String.fromCharCode(buf[ix - 1]) === '\r') ? (ix - 1) : ix
        ),
        index: ix + 1
      };
    }
  }
  return null;
};

//  read from start/0 up to the next newline and parse as a header: value object.
//  returns null if not valid or:
//  {
//    header: object with {key: value} representing the header
//    index: index in buffer of just past the newline
//  }
const readHeader = function(buf, start, len) {
  const line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  const str = line.str;
  let delim = str.indexOf(':');
  if (delim < 0) {
    return null;
  }
  const header = str.slice(0, delim);
  delim += 1;
  if (delim < str.length && str.charAt(delim) === ' ') {
    ++delim;
  }
  return {
    header,
    value: str.slice(delim),
    index: line.index
  };
};

// some urls were not parsing correctly (twitter.com) as they had ports included (twitter.com:443)
// partially copied from isaacs/url-parse-as-address and optimised.
//
// if uri contains 443 port so it's should be https, not http.
// it's dumb way but suitable for most cases.
const parseUrlOrAddress = function parseUrlOrAddress(uri) {
  let parsed = url.parse(uri, false);
  if (!parsed.slashes) {
    const prot = uri.indexOf(':443') > -1 ? 'https://' : 'http://';
    parsed = url.parse(prot + uri, false);
  } else if (!parsed.protocol) {
    const prot = uri.indexOf(':443') > -1 ? 'https:' : 'http:';
    parsed = url.parse(prot + uri, false);
  }

  parsed.query = querystring.parse(parsed.query);
  return parsed;
};

//  read from start/0 up to the next newline and parse as a HTTP/ICAP method line.
//  returns null if not valid method line or:
//  {
//    method: string of the method eg 'PUT' or 'RESPMOD'
//    url: string of the URI
//    version: string version eg 'ICAP/1.0' or 'HTTP/1.1'
//    index: index in buffer of just past the newline
//  }
const readMethod = function(buf, start, len) {
  const line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  const tokens = line.str.split(' ');
  if (tokens.length < 3) {
    return null;
  }
  const method = tokens.shift();
  const uri = tokens.shift();
  return {
    method,
    uri,
    parsedUri: parseUrlOrAddress(uri),
    version: tokens.join(' '),
    index: line.index,
    line: line.str
  };
};

const readStatus = function(buf, start, len) {
  const line = readLine(buf, start, len);
  if (!line) {
    return null;
  }
  const tokens = line.str.split(' ');
  if (tokens.length < 3) {
    return null;
  }
  return {
    version: tokens.shift(),
    code: parseInt(tokens.shift()) || 503,
    message: tokens.join(' '),
    index: line.index,
    line: line.str
  };
};

const readNewline = function(buf, start) {
  if (start < buf.length) {
    const ch2 = buf.toString('utf8', start, start + 2);
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
const encapsulated = function(valStr) {
  if (!valStr) {
    return null;
  }
  const valParts = valStr.split(',');
  const enc = [];
  for (let ix = 0; ix < valParts.length; ix++) {
    if (valParts[ix].length > 0 && valParts[ix][0] === ' ') {
      valParts[ix] = valParts[ix].substr(1);
    }
    const valPair = valParts[ix].split('=', 2);
    valPair[1] = parseInt(valPair[1], 10);
    enc.push(valPair);
  }
  return enc;
};

module.exports = {
  line: readLine,
  header: readHeader,
  method: readMethod,
  status: readStatus,
  newline: readNewline,
  encapsulated
};
