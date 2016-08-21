const helpers = require('./spec_helpers');

helpers.testIO('should ignore empty result from fullpage filter', 'empty_filter', (t, server, cb) => {
  // handle whitelisted domains normally
  server.request('*', (icapReq, icapRes, req, res, next) => {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapRes.setFilter(true, (data) => {
      return;
    });
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});


helpers.testIO('should ignore empty result from filter', 'empty_filter', (t, server, cb) => {
  // handle whitelisted domains normally
  server.request('*', (icapReq, icapRes, req, res, next) => {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapRes.setFilter((data) => {
      return;
    });
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});
