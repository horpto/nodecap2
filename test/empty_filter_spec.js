var helpers = require('./spec_helpers');

helpers.testIO('should ignore empty result from fullpage filter', 'empty_filter', function(t, server, cb) {
  // handle whitelisted domains normally
  server.request('*', function(icapReq, icapRes, req, res, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapRes.setFilter(true, function(data) {
      return;
    });
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});



helpers.testIO('should ignore empty result from filter', 'empty_filter', function(t, server, cb) {
  // handle whitelisted domains normally
  server.request('*', function(icapReq, icapRes, req, res, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapRes.setFilter(function(data) {
      return;
    });
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});
