const ICAPServer = require('../').ICAPServer;

//  run the server
const server = new ICAPServer({
  debug: false
});
console.log('Starting ICAP server...');
server.listen((port) => {
  console.log('ICAP server listening on port ' + port);
});

//  only configure RESPMOD bc only modifying responses
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
  icapRes.setIcapStatusCode(200);
  icapRes.setIcapHeaders(icapReq.headers);
  if (icapReq.isReqMod()) {
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
  } else {
    icapRes.setHttpStatus(res.code); // or icapRes.setHttpStatus(res);
    icapRes.setHttpHeaders(res.headers);
  }
  const hasBody = icapReq.hasBody();
  if (hasBody && !icapReq.ieof) {
    icapRes.continuePreview();
  }
  icapRes.writeHeaders(hasBody);
  // .pipe() or .end() must be called.
  icapReq.pipe(icapRes);
}


//  filter html responses
server.response('*', (icapReq, icapRes, req, res, next) => {
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

  // `filter` function should be a synchronous, but you can use streams now
  // configure a filter that will run only after the full response data is received
  icapRes.setFilter(true, (buffer) => {
    // buffer are always Buffer instance
    const str = buffer.toString('utf8');

    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpStatus(res.code);
    icapRes.setHttpHeaders(res.headers);
    icapRes.writeHeaders(icapReq.hasBody());

    // TODO: parse str -> html, modify html, html -> str here
    return str;
  });

  // the only immediate action is to request the full response body
  icapReq.pipe(icapRes); // or may be icapReq.pipe(zlib.createUnzip().pipe(icapRes));
  if (icapReq.hasBody() && !icapReq.ieof) {
    icapRes.continuePreview();
  }
  // explicitly do not go to next
});

//  allow all responses
server.response('*', acceptRequest);

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
