'use strict';

var get = require('http').get;

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

exports.awsebtdeploy = {
  setUp: function(done) {
    // setup here if necessary
    done();
  },
  end_to_end: function(test) {
    test.expect(1);

    get('http://awsebtdeploy-inplace.elasticbeanstalk.com', function(res) {
      var data = '';
      res.setEncoding('utf8');

      res.on('data', function(chunk){ data += chunk; });
      res.on('end', function() {
        test.equal(data, require('../app/package.json').version);
        test.done();
      });
    });
  }
};
