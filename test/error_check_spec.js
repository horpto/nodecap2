const helpers = require('./spec_helpers');

helpers.testIO('should call error handlers for bad requests', 'error_check', (t, server, cb) => {
  server.request('*', (icapReq, icapRes, req, res, next) => {
    console.log('request');
    throw new Error('TEST_REQUEST_ERROR');
  });

  server.response('*', (icapReq, icapRes, req, res, next) => {
    console.log('response');
    throw new Error('TEST_RESPONSE_ERROR');
  });

  setTimeout(cb, 1500);
});
