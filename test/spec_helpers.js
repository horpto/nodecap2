var fs = require('fs');
var path = require('path');
var net = require('net');
var test = require('tap').test;
var exampleConfig = require('./spec_server');
var ICAPServer = require('..').ICAPServer;

var datePattern = /Date\:\s*\w+,\s+\d{1,2}\s+\w+\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT/g;
var dateReplace = 'Date: ' + (new Date()).toGMTString();

var istagPattern = /ISTag\:\s*\S+/g;
var istagReplace = 'ISTag: NODECAP-TEST';

var sampleDir = 'samples/';

var noop = function() {};

var testIO = function(testName, sampleName, configureFn, configureInput) {
  configureFn = typeof configureFn === 'function' ? configureFn : null;
  var input = fs.readFileSync(path.resolve(__dirname, sampleDir + sampleName + '.in.txt'), 'utf8');
  var output = fs.readFileSync(path.resolve(__dirname, sampleDir + sampleName + '.out.txt'), 'utf8');

  test(testName, function(t) {
    var buffer = '';
    var server = new ICAPServer({
      logLevel: process.argv.indexOf('--debug') >= 0 ? 'debug' : 'info'
    });

    var doneFn = function(err, result) {
      if (err) {
        console.error(err);
      }
      if (result) {
        console.log(result);
      }
    };

    // run the test-specific server configuration before starting server & test
    if (configureFn) {
      configureFn(t, server, doneFn);
    }
    if (configureInput) {
      input = configureInput(input);
    }

    exampleConfig(server);
    server.listen(function() {
      var client = net.connect({port: 1344}, function() {
        client.write(input);
      });
      client.on('data', function(data) {
        buffer += data.toString('utf8');
      });
      client.on('end', function() {
        console.log('client end');
      });
      client.on('error', function(err) {
        console.error("CLIENT ERROR", err);
        if (err.stack) {
          console.error(err.stack);
        }
      });

      setTimeout(function() {
        client.end();
        buffer = buffer.replace(datePattern, dateReplace).replace(istagPattern, istagReplace);
        output = output.replace(datePattern, dateReplace).replace(istagPattern, istagReplace);
        //console.error("BUFFER:", buffer);
        //console.error("OUTPUT:", output);
        t.equal(buffer, output, 'should have expected icap responses');
        server.close(function() {
          t.end();
        });
      }, 1000);
    });
  });
};

module.exports = {
  testIO: testIO
};
