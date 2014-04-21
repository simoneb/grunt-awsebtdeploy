'use strict';

var get = require('http').get,
    AWS = require('aws-sdk'),
    credentials;

try {
  credentials = require('grunt-awsebtdeploy-credentials');
} catch (err) {
  credentials = {
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY
  };
}

AWS.config.update({
  region: 'eu-west-1',
  accessKeyId: credentials.accessKeyId,
  secretAccessKey: credentials.secretAccessKey
});

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

function checkResponse(test, res, callback) {
  var data = '';
  res.setEncoding('utf8');

  res.on('data', function (chunk) {
    data += chunk;
  });
  res.on('end', function () {
    test.equal(data, require('../app/package.json').version);
    callback();
  });
}

function terminateEnvironment(appName, callback) {
  var ebt = new AWS.ElasticBeanstalk(),
      cname = appName + '.elasticbeanstalk.com';

  console.log('Attempting to terminate idle environment for application ' + appName);

  ebt.describeEnvironments({ ApplicationName: appName, IncludeDeleted: false }, function (err, data) {
    if (err) throw err;

    if (data.Environments.length !== 2)
      throw new Error('Was expecting to find 2 active environments only');

    var envToDelete = data.Environments.filter(function (env) {
      return env.CNAME !== cname;
    });

    if (envToDelete.length !== 1) {
      throw new Error('Found ' + envToDelete.length +
          ' environments with a CNAME different from ' + cname);
    }

    ebt.terminateEnvironment({
      EnvironmentName: envToDelete[0].EnvironmentName
    }, function (err, data) {
      if (err) throw err;

      console.log('Successfully terminated environment ' + data.EnvironmentName);
      callback();
    });
  });
}

exports.awsebtdeploy = {
  setUp: function (done) {
    // setup here if necessary
    done();
  },
  in_place: function (test) {
    test.expect(1);

    get('http://awsebtdeploy-inplace.elasticbeanstalk.com', function (res) {
      checkResponse(test, res, test.done.bind(test));
    });
  },
  swap_to_new: function (test) {
    test.expect(1);

    get('http://awsebtdeploy-swaptonew.elasticbeanstalk.com', function (res) {
      // terminate old environment first, even if test later fails
      terminateEnvironment('awsebtdeploy-swaptonew', function () {
        checkResponse(test, res, test.done.bind(test));
      });
    });
  }
};
