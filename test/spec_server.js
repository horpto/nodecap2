
// run the server
module.exports = function(server) {
  // CONFIGURE OPTIONS
  server.options('/request', function(icapReq, icapRes, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders({
      'Methods': 'REQMOD',
      'Preview': '1024'
    });
    icapRes.writeHeaders(false);
    icapRes.end();
  });

  server.options('/response', function(icapReq, icapRes, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders({
      'Methods': 'RESPMOD',
      'Preview': '1024',
      'Transfer-Preview': '*',
      'Transfer-Ignore': 'jpg,jpeg,gif,png,swf,flv',
      'Transfer-Complete': '',
      'Max-Connections': '100'
    });
    icapRes.writeHeaders(false);
    icapRes.end();
  });

  server.options('*', function(icapReq, icapRes, next) {
    if (!icapRes.done) {
      icapRes.setIcapStatusCode(404);
      icapRes.writeHeaders(false);
      icapRes.end();
    }
  });

  // HANDLE REQMOD
  server.request('*', function(icapReq, icapRes, req, res, next) {
    // handle previews before doing anything else: icapReq.preview is buffer of preview data
    if (icapReq.hasPreview()) {
      icapRes.allowUnchanged();
      return;
    }
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapReq.pipe(icapRes);
  });

  // HANDLE RESPMOD
  server.response('*', function(icapReq, icapRes, req, res, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpStatus(res);
    icapRes.setHttpHeaders(res.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapReq.pipe(icapRes);
    // handle previews before doing anything else: icapReq.preview is buffer of preview data
    if (icapReq.hasBody() && !icapReq.ieof) {
      icapRes.continuePreview();
      return;
    }
  });

  // HANDLE ERRORS
  server.error(function(err, icapReq, icapRes, next) {
    // console.error(err);
    // console.error(err.message, err.stack || 'no stack trace');
    if (!icapRes.done) {
      icapRes.setIcapStatusCode(500);
      icapRes.writeHeaders(false);
      icapRes.end();
    }
    next();
  });

  return server;
};
