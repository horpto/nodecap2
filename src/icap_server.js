"use strict";

const net = require('net');
const util = require('util');
const winston = require('winston');
const EventEmitter = require('eventemitter3');
const ICAPHandler = require('./icap_handler');
const DomainList = require('./domainlist');

const noop = require('./utils').noop;

/*
 *  ICAPServer
 */
function ICAPServer(options) {
  EventEmitter.call(this);
  this.id = util.format('[%d::server]', process.pid);
  this.logger = options.logger || new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: options.logLevel || 'info',
        timestamp: true
      })
    ]
  });

  options = Object.assign({
    logger: this.logger,
    chunkSize: 4096
  }, options || {});

  this.server = net.createServer(function(stream) {
    new ICAPHandler(stream, this, options);
  }.bind(this));
  this.protocolVersion = 'ICAP/1.0';
  this.systemVersion = 'Node/1';
  this.serverVersion = 'BaseICAP/1.0';

  this._errorCallbacks = [];
  this.on('error', function(err, icapReq, icapRes) {
    function next() {
      const fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      fn.call(self, err, icapReq, icapRes, next);
    }

    let ix = 0;
    const cbs = this._errorCallbacks, self = this;
    try {
      ix = 0;
      next();
    } catch (e) {
      try {
        icapRes.end();
        this.logger.error('%s ERROR "%s"', this.id, e.message || 'Unknown Error');
      } catch (ee) {
        // can't do anything
      }
    } finally {
      this.logger.error('%s ERROR - httpmethod: %s - err: %s', this.id, (icapRes.httpMethod || []).join(' '), err.stack || err.message || 'Unknown Error');
    }
  }, this);

  this._optionsCallbacks = [];
  this.on('icapOptions', function(icapReq, icapRes) {
    function next() {
      const fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].test(pathname)) {
        fn[1].call(self, icapReq, icapRes, next);
      } else {
        next();
      }
    }

    let ix = 0, pathname;
    const cbs = this._optionsCallbacks, self = this;
    try {
      pathname = icapReq.parsedUri.pathname;
      next();
      this.logger.info('%s OPTIONS - %s - %s', this.id, (icapRes.icapStatus || []).join(' '), (icapRes.httpMethod || []).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }, this);

  this._requestCallbacks = [];
  this.on('httpRequest', function(icapReq, icapRes, req, res) {
    function next() {
      const fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].contains(host)) {
        fn[1].call(self, icapReq, icapRes, req, res, next);
      } else {
        next();
      }
    }

    let ix = 0, host;
    const cbs = this._requestCallbacks, self = this;
    try {
      host = req.parsedUri.hostname;
      next();
      this.logger.info('%s REQMOD - %s - %s - %s', this.id, (icapRes.icapStatus || []).join(' '), req.line, (icapRes.httpMethod || []).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }, this);

  this._responseCallbacks = [];
  this.on('httpResponse', function(icapReq, icapRes, req, res) {
    function next() {
      const fn = cbs[ix++];
      if (!fn || icapRes.done) {
        return;
      }
      if (!fn[0] || fn[0].contains(host)) {
        fn[1].call(self, icapReq, icapRes, req, res, next);
      } else {
        next();
      }
    }

    let ix = 0, host;
    const cbs = this._responseCallbacks, self = this;
    try {
      host = req.parsedUri.hostname;
      next();
      this.logger.info('%s RESPMOD - %s - %s - %s', this.id, (icapRes.icapStatus || []).join(' '), req.line, (icapRes.httpMethod || []).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }, this);
}

ICAPServer.prototype = Object.assign({}, EventEmitter.prototype, {
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
    if (typeof cb != 'function') {
      throw new TypeError("expected function, not " + typeof cb);
    }
    this._errorCallbacks.push(cb);
  },

  options: function(path, cb) {
    if (!path || path === '*') {
      path = null;
    } else if (!(path instanceof RegExp)) {
      path = new RegExp('^' + path + '$');
    }
    if (typeof cb != "function") {
      throw new TypeError("expected function, not " + typeof cb);
    }
    this._optionsCallbacks.push([path, cb]);
  },

  request: function(domain, cb) {
    let domainList;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainList = new DomainList();
      domainList.add(domain);
    }
    if (typeof cb != "function") {
      throw new TypeError("expected function, not " + typeof cb);
    }
    this._requestCallbacks.push([domainList, cb]);
  },

  response: function(domain, cb) {
    let domainList;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainList = new DomainList();
      domainList.add(domain);
    }
    if (typeof cb != "function") {
      throw new TypeError("expected function, not " + typeof cb);
    }
    this._responseCallbacks.push([domainList, cb]);
  }
});

module.exports = ICAPServer;
