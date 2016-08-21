const helpers = require('./spec_helpers');

helpers.testIO('ICAPRequest should get mime type of preview', 'mime', (t, server, cb) => {
  server.response('*', (icapReq, icapRes, req, res, next) => {
    t.ok(icapReq.hasPreview(), 'should have a preview');
    icapReq.getPreviewMime((err, result) => {
      if (err) {
        return cb(err);
      }
      t.equal(result, 'text/html', 'MIME should be html');
      return cb(null);
    });

    next();
  });
});
