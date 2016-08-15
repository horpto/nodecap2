var helpers = require('./spec_helpers');

helpers.testIO('ICAPRequest should get mime type of preview', 'mime', function(t, server, cb) {
  server.response('*', function(icapReq, icapRes, req, res, next) {
    t.ok(icapReq.hasPreview(), 'should have a preview');
    icapReq.getPreviewMime(function(err, result) {
      if (err) {
        return cb(err);
      }
      t.equal(result, 'text/html', 'MIME should be html');
      return cb(null);
    });

    next();
  });
});
