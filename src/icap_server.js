"use strict";

var net = require('net');
var util = require('util');
var winston = require('winston');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var ICAPHandler = require('./icap_handler');
var DomainList = require('./domainlist');

var _utils = require('./utils');
var noop = _utils.noop;
var assign = _utils.assign;

/*
 *  ICAPServer
 */
function ICAPServer(options) {
  EventEmitter2.call(this, {
    wildcard: true,
    delimiter: '/'
  });
  this.id = util.format('[%d::server]', process.pid);
  this.logger = options.logger || new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: options.logLevel || 'info',
        timestamp: true
      })
    ]
  });

  options = assign({
    logger: this.logger,
    chunkSize: 4096
  }, options || {});

  this.server = net.createServer(function(stream) {
    var handler = new ICAPHandler(stream, this, options);
  }.bind(this));
  this.protocolVersion = 'ICAP/1.0';
  this.systemVersion = 'Node/1';
  this.serverVersion = 'BaseICAP/1.0';

  this._errorCallbacks = [];
  this.on('error', function(err, icapReq, icapRes) {
    function next() {
      var fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      fn.call(self, err, icapReq, icapRes, next);
    }

    var ix, cbs, self = this;
    try {
      ix = 0;
      cbs = this._errorCallbacks;
      next();
    } catch (e) {
      try {
        icapRes.end();
        this.logger.error('%s ERROR "%s"', this.id, e.message || 'Unknown Error');
      } catch (ee) {
        // can't do anything
      }
    } finally {
      this.logger.error('%s ERROR - %s - %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), err.message || 'Unknown Error');
    }
  }.bind(this));

  this._optionsCallbacks = [];
  this.on('icapOptions', function(icapReq, icapRes) {
    function next() {
      var fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].test(pathname)) {
        fn[1].call(self, icapReq, icapRes, next);
      } else {
        next();
      }
    }

    var ix, cbs, pathname, self = this;
    try {
      ix = 0;
      cbs = this._optionsCallbacks;
      pathname = icapReq.parsedUri.pathname;
      next();
      this.logger.info('%s OPTIONS - %s %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));

  this._requestCallbacks = [];
  this.on('httpRequest', function(icapReq, icapRes, req, res) {
    function next() {
      var fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].contains(host)) {
        fn[1].call(this, icapReq, icapRes, req, res, next);
      } else {
        next();
      }
    }

    var ix, cbs, host, self = this;
    try {
      ix = 0;
      cbs = this._requestCallbacks;
      host = req.parsedUri.hostname;
      next();
      this.logger.info('%s REQMOD - %s - %s %s - %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), req.method, req.parsedUri.protocol + '//' + req.parsedUri.host + req.parsedUri.pathname, (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));

  this._responseCallbacks = [];
  this.on('httpResponse', function(icapReq, icapRes, req, res) {
    function next() {
      var fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].contains(host)) {
        fn[1].call(self, icapReq, icapRes, req, res, next);
      } else {
        next();
      }
    }

    var ix, cbs, host, self = this;
    try {
      ix = 0;
      cbs = this._responseCallbacks;
      host = req.parsedUri.hostname;
      next();
      this.logger.info('%s RESPMOD - %s - %s %s - %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), req.method, req.parsedUri.protocol + '//' + req.parsedUri.host + req.parsedUri.pathname, (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));
}

ICAPServer.prototype = assign({}, EventEmitter2.prototype, {
  constructor: ICAPServer,

  listen: function(port, fn) {
    if (typeof port === 'function') {
      fn = port;
      port = null;
    }
    port = port || 1344;
    fn = fn || noop;
    this.server.listen(port, fn.bind(undefined, port));
  },

  close: function(fn) {
    fn = fn || noop;
    this.server.close(fn);
  },

  error: function(cb) {
    this._errorCallbacks.push(cb);
  },

  options: function(path, cb) {
    if (!path || path === '*') {
      path = null;
    } else if (!(path instanceof RegExp)) {
      path = new RegExp('^' + path + '$');
    }
    this._optionsCallbacks.push([path, cb]);
  },

  request: function(domain, cb) {
    var domainList;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainList = new DomainList();
      domainList.add(domain);
    }
    this._requestCallbacks.push([domainList, cb]);
  },

  response: function(domain, cb) {
    var domainList;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainList = new DomainList();
      domainList.add(domain);
    }
    this._responseCallbacks.push([domainList, cb]);
  }
});

module.exports = ICAPServer;
