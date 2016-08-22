'use strict';

const helpers = require('./spec_helpers');
const zlib = require('zlib');

helpers.testIO('should support streams', 'stream', (t, server, cb) => {
  // handle whitelisted domains normally
  server.request('*', (icapReq, icapRes, req, res, next) => {
    icapRes.setIcapStatusCode(200);
    icapRes.setIcapHeaders(icapReq.headers);
    icapRes.setHttpMethod(req);
    icapRes.setHttpHeaders(req.headers);
    icapRes.writeHeaders(icapReq.hasBody());

    const unzipper = zlib.createUnzip();
    unzipper.pipe(icapRes);
    icapReq.pipe(unzipper);
  });

  setTimeout(cb, 1500);
},
(input) =>{
  const firstCh = zlib.gzipSync('I am posting this information.');
  const secondCh = zlib.gzipSync('I was posting that information.');

  input = input.replace('POST_FIRST_CHUNK_HERE', firstCh.length.toString(16) + '\r\n' + firstCh.toString('binary'));
  input = input.replace('POST_SECOND_CHUNK_HERE', secondCh.length.toString(16) + '\r\n' + secondCh.toString('binary'));
  return new Buffer(input, 'binary');
});
