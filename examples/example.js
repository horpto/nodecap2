const ICAPServer = require('../').ICAPServer;
const DomainList = require('../').DomainList;

//  whitelist of allowed sites
const whitelist = new DomainList();
whitelist.addMany([
  'whitelisted.example.com', // match fixed domain
  '.whitelisted.example.net' // match fixed domain and all subdomains
]);

//  run the server
const server = new ICAPServer({
  debug: false
});
console.log('Starting ICAP server...');
server.listen((port) => {
  console.log('ICAP server listening on port ' + port);
});

//  configure options
//    to have different options for requests and responses,
//    configure squid to send these to different ICAP resource paths
//  REQMOD
server.options('/request', (icapReq, icapRes, next) => {
  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders({
    'Methods': 'REQMOD',
    'Preview': '128'
  });
  icapRes.writeHeaders(false);
  icapRes.end();
});

//  RESPMOD
server.options('/response', (icapReq, icapRes, next) => {
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
server.options('*', (icapReq, icapRes, next) => {
  if (!icapRes.done) {
    icapRes.setIcapStatusCode(404);
    icapRes.writeHeaders(false);
    icapRes.end();
    return;
  }
  next();
});


//  helper to accept a request/response
function acceptRequest(icapReq, icapRes, req, res) {
  if (!icapRes.hasFilter() && icapReq.hasPreview()) {
    icapRes.allowUnchanged();
    return;
  }
  // only example how are presented multiple headers in request
  req.headers['X-Example'] = ['flag{12345-FirstHeader}', 'second header'];
  // Response will contain two different header:
  // X-Example: flag{12345-FirstHeader}
  // X-Example: second header

  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders(icapReq.headers);
  if (icapReq.isReqMod()) {
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
  } else {
    icapRes.setHttpStatus(res.code);
    icapRes.setHttpHeaders(res.headers);
  }
  const hasBody = icapReq.hasBody();
  if (hasBody) {
    icapRes.continuePreview();
  }
  icapRes.writeHeaders(hasBody);
  icapReq.pipe(icapRes);
}

const errorPage = "page blocked";

//  helper to reject a request/response
function rejectRequest(icapReq, icapRes, req, res) {
  let hasBody = false;
  const headers = {};
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
    // only one calling at once.
    icapRes.send(errorPage);
  } else {
    icapRes.writeHeaders(false);
  }
  // WARNING: don't forget to write.end() after .send()
  // or your data will not send.:(
  icapRes.end();
}


//  handlers
//  accept request/response if domain on whitelist
server.request(whitelist, acceptRequest);
server.response(whitelist, acceptRequest);

//  reject otherwise
server.request('*', rejectRequest);
server.response('*', rejectRequest);


//  errors
//  icap error
server.error((err, icapReq, icapRes, next) => {
  console.error(err);
  if (!icapRes.done) {
    icapRes.setIcapStatusCode(500);
    icapRes.writeHeaders(false);
    icapRes.end();
  }
  next();
});

//  general application error
process.on('uncaughtException', (err) => {
  console.error(err.message);
  if (err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
