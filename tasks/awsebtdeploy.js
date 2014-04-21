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

  function createEnvironmentName(applicationName) {
    var maxLength = 23,
        time = new Date().getTime().toString(),
        timeLength = time.length,
        availableSpace = maxLength - applicationName.length,
        timePart = time.substring(timeLength - availableSpace, timeLength);

    if (applicationName.length > maxLength - 3)
      grunt.log.write('Warning: application name is too long to guarantee ' +
          'a unique environment name, whose maximum length cannot exceed ' + maxLength);

    return applicationName + timePart;
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
          versionLabel: path.basename(this.data.options.sourceBundle,
              path.extname(this.data.options.sourceBundle)),
          versionDescription: '',
          deployType: 'inPlace',
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

    // overwriting properties which might have been passed but undefined
    if(!options.accessKeyId) options.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    if(!options.secretAccessKey) options.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

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

      switch (options.deployType) {
        case 'inPlace':
          inPlaceDeploy(env);
          break;
        case 'swapToNew':
          swapDeploy(env);
          break;
        default:
          grunt.warn('Deploy type "' + options.deployType + '" unrecognized');
      }
    }

    function swapDeploy(env) {
      grunt.log.write('Creating configuration template of current environment for swap deploy...');

      var templateName = options.applicationName + '-' + new Date().getTime();

      send(ebt.createConfigurationTemplate({
        ApplicationName: options.applicationName,
        EnvironmentId: env.EnvironmentId,
        TemplateName: templateName
      }), createConfigurationTemplateCb.bind(task, env));
    }

    function createConfigurationTemplateCb(env, data) {
      grunt.log.ok();

      var newEnvName = createEnvironmentName(options.applicationName);

      grunt.log.write('Creating new environment "' + newEnvName + '"...');

      send(ebt.createEnvironment({
        ApplicationName: options.applicationName,
        EnvironmentName: newEnvName,
        VersionLabel: options.versionLabel,
        TemplateName: data.TemplateName
      }), createEnvironmentCb.bind(task, env));
    }

    function createEnvironmentCb(oldEnv, newEnv) {
      grunt.log.ok();

      waitForDeployment(newEnv, function () {
        grunt.log.write('Swapping environment CNAMEs...');

        // here it is quite possible that the app is still not running
        // we should probably allow to check that with a health URL

        send(ebt.swapEnvironmentCNAMEs({
          SourceEnvironmentName: oldEnv.EnvironmentName,
          DestinationEnvironmentName: newEnv.EnvironmentName
        }), swapEnvironmentCNAMEsCb.bind(task, oldEnv, newEnv));
      }, 10000);
    }

    function swapEnvironmentCNAMEsCb(oldEnv, newEnv) {
      grunt.log.ok();

      // here it is quite possible that DNS is still pointing to
      // the old environment and that the application is not yet full up

      done();
    }

    function inPlaceDeploy(env) {
      grunt.log.write('Updating environment for in-place deploy...');

      send(ebt.updateEnvironment({
        EnvironmentName: env.EnvironmentName,
        VersionLabel: options.versionLabel,
        Description: options.versionDescription
      }), updateEnvironmentCb.bind(task, env));
    }

    function waitForDeployment(env, callback, delay) {
      delay = delay || 5000;

      grunt.log.writeln('Waiting for application to be deployed to environment...');

      function fn() {
        send(ebt.describeEnvironments({
          ApplicationName: options.applicationName,
          EnvironmentNames: [env.EnvironmentName],
          VersionLabel: options.versionLabel,
          IncludeDeleted: false
        }), describeCb);
      }

      function describeCb(data) {

        if (!data.Environments.length) {
          grunt.log.writeln(options.versionLabel + ' still not deployed to ' +
              env.EnvironmentName + ' ...');
          return setTimeout(fn, delay);
        }

        var currentEnv = data.Environments[0];

        if (currentEnv.Status !== 'Ready') {
          grunt.log.writeln('Environment ' + currentEnv.EnvironmentName +
              ' status: ' + currentEnv.Status + '...');
          return setTimeout(fn, delay);
        }

        if (currentEnv.Health !== 'Green') {
          grunt.log.writeln('Environment ' + currentEnv.EnvironmentName +
              ' health: ' + currentEnv.Health + '...');
          return setTimeout(fn, delay);
        }

        grunt.log.writeln(options.versionLabel + ' has been deployed to ' +
            currentEnv.EnvironmentName + ' and environment is Ready and Green');

        return callback();
      }

      setTimeout(fn, delay);
    }

    function updateEnvironmentCb(env) {
      grunt.log.ok();
      waitForDeployment(env, done);
    }

    grunt.log.write('Checking that application "' + options.applicationName + '" exists...');

    send(ebt.describeApplications({
      ApplicationNames: [options.applicationName]
    }), describeApplicationsCb);
  });
};