var helpers = require('./spec_helpers');

helpers.testIO('should correctly collect multiple headers in http', 'multiple_headers', function(test, server, cb) {
  server.request('*', function(icapReq, icapRes, req, res) {
    var cookie = [
      'MoodleSession=usdecqmal2h23rdh1c7hqjcuj3; path=/',
      'MOODLEID1_=deleted; expires=Thu, 01-Jan-1970 00:00:01 GMT; Max-Age=0; path=/'
    ].join();
    test.type(req.headers['Set-Cookie'], Array, "Set-Cookie headers should be array");
    test.equal(req.headers['Set-Cookie'].join(), cookie, 'Set-Cookie should contain all values');

    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});
