var helpers = require('./spec_helpers');
var DomainList = require('..').DomainList;

helpers.testIO('server should allow whitelist and block unlisted domains', 'whitelist', function(t, server, cb) {
  var domains = new DomainList();
  domains.add('allowed.com');

  // handle whitelisted domains normally
  server.request(domains, function(icapReq, icapRes, req, res, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapReq.pipe(icapRes);
  });

  // handle all other domains with 403 rejected
  server.request('*', function(icapReq, icapRes, req, res, next) {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpStatus(403);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(true);
    icapRes.send('NO');
  });

  setTimeout(cb, 1500);
});
