/*
 * grunt-awsebtdeploy
 * https://github.com/simoneb/grunt-awsebtdeploy
 *
 * Copyright (c) 2014 Simone Busoli
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  var AWS = require('aws-sdk'),
      path = require('path'),
      fs = require('fs');

  function findEnvironmentByCNAME(data, cname) {
    if (!data || !data.Environments) return false;

    return data.Environments.filter(function (e) {
      return e.CNAME === cname;
    })[0];
  }

  grunt.registerMultiTask('awsebtdeploy', 'A grunt plugin to deploy applications to AWS Elastic Beanstalk', function () {
    if (!this.data.options.applicationName) grunt.warn('Missing "applicationName"');
    if (!this.data.options.environmentCNAME) grunt.warn('Missing "environmentCNAME"');
    if (!this.data.options.region) grunt.warn('Missing "region"');
    if (!this.data.options.sourceBundle) grunt.warn('Missing "sourceBundle"');

    if (!grunt.file.isFile(this.data.options.sourceBundle))
      grunt.warn('"sourceBundle" points to a non-existent file');

    var task = this,
        done = this.async(),
        options = this.options({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          versionLabel: path.basename(this.data.options.sourceBundle,
              path.extname(this.data.options.sourceBundle)),
          versionDescription: '',
          wait: false,
          s3: {
            bucket: this.data.options.applicationName,
            key: path.basename(this.data.options.sourceBundle)
          }
        }), s3, ebt;

    function send(req, next) {
      function wrap(action) {
        return function (res) {
          return action(res.data);
        };
      }
      return req.on('success', wrap(next)).on('error', done).send();
    }

    if (!options.accessKeyId) grunt.warn('Missing "accessKeyId"');
    if (!options.secretAccessKey) grunt.warn('Missing "secretAccessKey"');

    AWS.config.update({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region
    });



    grunt.log.subhead('Operating in region "' + options.region + '"');

    ebt = new AWS.ElasticBeanstalk();
    s3 = new AWS.S3();

    function describeApplicationsCb(data) {
      grunt.verbose.writeflags(data, 'Applications');

      if (!data.Applications.length) {
        grunt.log.error();
        grunt.warn('Application "' + options.applicationName + '" does not exist');
      }

      grunt.log.ok();
      grunt.log.write('Checking that environment with CNAME "' + options.environmentCNAME + '" exists...');

      send(ebt.describeEnvironments({
        ApplicationName: options.applicationName,
        IncludeDeleted: false
      }), describeEnvironmentsCb);
    }

    function describeEnvironmentsCb(data) {
      grunt.verbose.writeflags(data, 'Environments');

      var env = findEnvironmentByCNAME(data, options.environmentCNAME);

      if (!env) {
        grunt.log.error();
        grunt.warn('Environment with CNAME "' + options.environmentCNAME + '" does not exist');
      }

      grunt.log.ok();

      var s3Object = {};

      for (var key in options.s3) {
        if (options.s3.hasOwnProperty(key)) {
          s3Object[key.substring(0, 1).toUpperCase() + key.substring(1)] =
              options.s3[key];
        }
      }

      grunt.verbose.writeflags(s3Object, 's3Param');

      s3Object.Body = new Buffer(fs.readFileSync(options.sourceBundle));

      grunt.log.write('Uploading source bundle "' + options.sourceBundle +
          '" to S3 location "' + options.s3.bucket + '/' + options.s3.key + '"...');

      send(s3.putObject(s3Object), putS3ObjectCb.bind(task, env));
    }

    function putS3ObjectCb(env) {
      grunt.log.ok();
      grunt.log.write('Creating application version "' + options.versionLabel + '"...');

      send(ebt.createApplicationVersion({
        ApplicationName: options.applicationName,
        VersionLabel: options.versionLabel,
        SourceBundle: {
          S3Bucket: options.s3.bucket,
          S3Key: options.s3.key
        }
      }), createApplicationVersionCb.bind(task, env));
    }

    function createApplicationVersionCb(env) {
      grunt.log.ok();
      grunt.log.write('Updating environment...');

      send(ebt.updateEnvironment({
        EnvironmentName: env.EnvironmentName,
        VersionLabel: options.versionLabel,
        Description: options.versionDescription
      }), updateEnvironmentCb.bind(task, env));
    }

    function updateEnvironmentCb(env) {
      function fn() {
        send(ebt.describeEnvironments({
          ApplicationName: options.applicationName,
          EnvironmentNames: [env.EnvironmentName],
          VersionLabel: options.versionLabel,
          IncludeDeleted: false
        }), cb);
      }

      function cb(data) {
        if (!data.Environments.length) {
          grunt.log.writeln(options.versionLabel + ' still not deployed...');
          return setTimeout(fn, 5000);
        }

        var currentEnv = data.Environments[0];

        if (currentEnv.Status !== 'Ready') {
          grunt.log.writeln('Environment is in state ' + currentEnv.Status + '...');
          return setTimeout(fn, 5000);
        }

        if (currentEnv.Health !== 'Green') {
          grunt.log.writeln('Environment health is ' + currentEnv.Health + '...');
          return setTimeout(fn, 5000);
        }

        grunt.log.ok(options.versionLabel +
            ' has been deployed and environment is Ready and Green');

        return done();
      }

      grunt.log.ok();

      if (!options.wait) {
        done();
      } else {
        grunt.log.writeln('Waiting for environment to become ready...');
        setTimeout(fn, 5000);
      }
    }

    grunt.log.write('Checking that application "' + options.applicationName + '" exists...');

    send(ebt.describeApplications({
      ApplicationNames: [options.applicationName]
    }), describeApplicationsCb);
  });
};