var net = require('net');
var util = require('util');
var _ = require('lodash');
var winston = require('winston');
var EventEmitter2 = require('eventemitter2').EventEmitter2;
var ICAPHandler = require('./icap_handler');
var DomainList = require('./domainlist');

var noop = function() {};

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

  options = _.defaults(options || {}, {
    logger: this.logger
  });

  this.server = net.createServer(function(stream) {
    var handler = new ICAPHandler(stream, this, options);
  }.bind(this));
  this.protocolVersion = 'ICAP/1.0';
  this.systemVersion = 'Node/1';
  this.serverVersion = 'BaseICAP/1.0';

  this.errorCallbacks = [];
  this.on('error', function(err, icapReq, icapRes) {
    var ix, cbs;
    try {
      ix = 0;
      cbs = this.errorCallbacks;
      function next() {
        var fn = cbs[ix++];
        if (!fn || icapRes.done) {
          return;
        }
        fn.call(this, err, icapReq, icapRes, next);
      }
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

  this.optionsCallbacks = [];
  this.on('icapOptions', function(icapReq, icapRes) {
    var ix, cbs, pathname;
    try {
      ix = 0;
      cbs = this.optionsCallbacks;
      pathname = icapReq.parsedUri.pathname;
      function next() {
        var fn = cbs[ix++];
        if (!fn || icapRes.done) {
          return;
        }
        if (!fn[0] || fn[0].test(pathname)) {
          fn[1].call(this, icapReq, icapRes, next);
        } else {
          next();
        }
      }
      next();
      this.logger.info('%s OPTIONS - %s %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));

  this.requestCallbacks = [];
  this.on('httpRequest', function(icapReq, icapRes, req, res) {
    var ix, cbs, host;
    try {
      ix = 0;
      cbs = this.requestCallbacks;
      host = req.parsedUri.hostname;
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
      next();
      this.logger.info('%s REQMOD - %s - %s %s - %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), req.method, req.parsedUri.protocol + '//' + req.parsedUri.host + req.parsedUri.pathname, (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));

  this.responseCallbacks = [];
  this.on('httpResponse', function(icapReq, icapRes, req, res) {
    var ix, cbs, host;
    try {
      ix = 0;
      cbs = this.responseCallbacks;
      host = req.parsedUri.hostname;
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
      next();
      this.logger.info('%s RESPMOD - %s - %s %s - %s', this.id, (icapRes.icapStatus || [null,null,null]).join(' '), req.method, req.parsedUri.protocol + '//' + req.parsedUri.host + req.parsedUri.pathname, (icapRes.httpMethod || [null,null,null]).join(' '));
    } catch (e) {
      this.emit('error', e, icapReq, icapRes);
    }
  }.bind(this));
}

ICAPServer.prototype = _.extend({}, EventEmitter2.prototype, {
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
    this.errorCallbacks.push(cb);
  },

  options: function(path, cb) {
    if (!path || path === '*') {
      path = null;
    } else if (!(path instanceof RegExp)) {
      path = new RegExp('^' + path + '$');
    }
    this.optionsCallbacks.push([path, cb]);
  },

  request: function(domain, cb) {
    var domainlist;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainlist = new DomainList();
      domainList.add(domain);
    }
    this.requestCallbacks.push([domainList, cb]);
  },

  response: function(domain, cb) {
    var domainlist;
    if (!!domain && domain instanceof DomainList) {
      domainList = domain;
    } else if (!domain || domain === '*') {
      domainList = null;
    } else {
      domainlist = new DomainList();
      domainList.add(domain);
    }
    this.responseCallbacks.push([domainList, cb]);
  }
});

module.exports = ICAPServer;
