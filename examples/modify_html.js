var ICAPServer = require('../').ICAPServer;

//  run the server
var server = new ICAPServer({
  debug: false
});
console.log('Starting ICAP server...');
server.listen(function(port) {
  console.log('ICAP server listening on port ' + port);
});

//  only configure RESPMOD bc only modifying responses
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
    icapRes.setHttpStatus(res.code); // or icapRes.setHttpStatus(res);
    icapRes.setHttpHeaders(res.headers);
  }
  var hasBody = icapReq.hasBody();
  if (hasbody) {
    icapRes.continuePreview();
  }
  icapRes.writeHeaders(hasBody);
  icapReq.pipe(icapRes);
};

//  filter method
var filterHtml = function(data) {
  var str = data.toString();
  // parse dom from str, modify, convert back to string
  // pseudocode:
  //  var dom = parseHtml(str);
  //  dom.modify();
  //  str = dom.toString();
  return str;
}

//  filter html responses
server.response('*', function(icapReq, icapRes, req, res, next) {
  // pass through if http error
  if (res.code !== 200) {
    return next();
  }

  // pass through if no preview
  if (!icapReq.hasPreview() || !icapReq.preview || icapReq.preview.length < 10) {
    return next();
  }

  // pass through non-html
  if (icapReq.preview.toString('utf8').indexOf('<html') < 0) {
    return next();
  }

  // configure a filter that will run only after the full response data is received
  icapRes.setFilter(true, function(buffer) {
    var str = buffer.toString('utf8');

    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpStatus(res.code);
    icapRes.setHttpHeaders(res.headers);
    icapRes.writeHeaders(icapReq.hasBody());

    // TODO: parse str -> html, modify html, html -> str here
    return str;
  });

  // the only immediate action is to request the full response body
  icapReq.pipe(icapRes);
  if (icapReq.hasPreviewBody() && !icapReq.ieof) {
    icapRes.continuePreview();
  }
  // explicitly do not go to next
});

//  allow all responses
server.response('*', acceptRequest);

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
