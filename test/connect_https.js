var helpers = require('./spec_helpers');

helpers.testIO('HTTPRequest should replace', 'connect', function(test, server, cb) {
  // handle whitelisted domains normally
  server.request('*', function(icapReq, icapRes, req, res, next) {
    test.equal(req.method, "CONNECT", "Wait 'CONNECT' method");
    test.equal(req.parsedUri.protocol, "https:", "Wait https protocol");

    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});
