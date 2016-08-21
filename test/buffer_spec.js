var helpers = require('./spec_helpers');

var replaceWords = function(icap, pattern, value) {
  icap.uri = icap.uri.replace(pattern, value);
  for (var key in icap.headers) {
    if (!icap.headers.hasOwnProperty(key) || !icap.headers[key]) {
      continue;
    }
    icap.headers[key] = icap.headers[key].replace(pattern, value);
  }
};

helpers.testIO('should replace "posting" with "-------" via buffer', 'buffer', function(t, server, cb) {
  // handle whitelisted domains normally
  server.request('*', function(icapReq, icapRes, req) {
    replaceWords(req, /posting/g, function(match) {
      var str = '', ix = match.length;
      while (ix--) {
        str += '-';
      }
      return str;
    });

    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());
    icapRes.setFilter(true, function(data) {
      var str = data.toString();
      if (/posting/.test(str)) {
        return str.replace(/posting/g, '-------');
      }
      return data;
    });
    icapReq.pipe(icapRes);
  });

  setTimeout(cb, 1500);
});
