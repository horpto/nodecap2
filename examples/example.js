var ICAPServer = require('../').ICAPServer;
var DomainList = require('../').DomainList;

//  whitelist of allowed sites
var whitelist = new DomainList();
whitelist.addMany([
  'whitelisted.example.com', // match fixed domain
  '.whitelisted.example.net' // match fixed domain and all subdomains
]);

//  run the server
var server = new ICAPServer({
  debug: false
});
console.log('Starting ICAP server...');
server.listen(function(port) {
  console.log('ICAP server listening on port ' + port);
});

//  configure options
//    to have different options for requests and responses,
//    configure squid to send these to different ICAP resource paths
//  REQMOD
server.options('/request', function(icapReq, icapRes, next) {
  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders({
    'Methods': 'REQMOD',
    'Preview': '128'
  });
  icapRes.writeHeaders(false);
  icapRes.end();
});

//  RESPMOD
server.options('/response', function(icapReq, icapRes, next) {
  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders({
    'Methods': 'RESPMOD',
    'Preview': '128',
    'Transfer-Preview': '*',
    'Transfer-Ignore': 'jpg,jpeg,gif,png',
    'Transfer-Complete': '',
    'Max-Connections': '100'
  });
  icapRes.writeHeaders(false);
  icapRes.end();
});

//  return error if options path not recognized
server.options('*', function(icapReq, icapRes, next) {
  if (!icapRes.done) {
    icapRes.setIcapStatusCode(404);
    icapRes.writeHeaders(false);
    icapRes.end();
    return;
  }
  next();
});


//  helper to accept a request/response
var acceptRequest = function(icapReq, icapRes, req, res) {
  if (!icapRes.hasFilter() && icapReq.hasPreview()) {
    icapRes.allowUnchanged();
    return;
  }
  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders(icapReq.headers);
  if (icapReq.isReqMod()) {
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
  } else {
    icapRes.setHttpMethod(res);
    icapRes.setHttpHeaders(res.headers);
  }
  var hasBody = icapReq.hasBody();
  if (hasBody) {
    icapRes.continuePreview();
  }
  icapRes.writeHeaders(hasBody);
  icapReq.pipe(icapRes);
};

//  helper to reject a request/response
var rejectRequest = function(icapReq, icapRes, req, res) {
  var hasBody = false, headers = {};
  // do *not* set Content-Length: causes an issue with Squid
  if (req.headers && 'Accept' in req.headers && req.headers['Accept'].indexOf('text') >= 0) {
    hasBody = true;
    headers['Content-Type'] = 'text/html; charset=UTF-8';
  }

  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders(icapReq.headers);
  icapRes.setHttpStatus(403);
  icapRes.setHttpHeaders(headers);
  if (hasBody) {
    icapRes.writeHeaders(true);
    icapRes.send(errorPage);
  } else {
    icapRes.writeHeaders(false);
  }
};


//  handlers
//  accept request/response if domain on whitelist
server.request(whitelist, acceptRequest);
server.response(whitelist, acceptRequest);

//  reject otherwise
server.request('*', rejectRequest);
server.response('*', rejectRequest);


//  errors
//  icap error
server.error(function(err, icapReq, icapRes, next) {
  console.error(err);
  if (!icapRes.done) {
    icapRes.setIcapStatusCode(500);
    icapRes.writeHeaders(false);
    icapRes.end();
  }
  next();
});

//  general application error
process.on('uncaughtException', function(err) {
  console.error(err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
