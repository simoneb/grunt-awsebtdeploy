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

  grunt.registerMultiTask('awsebtdeploy', 'A grunt plugin to deploy applications to AWS Elastic Beanstalk', function () {
    if (!this.data.options.applicationName) grunt.warn('Missing "applicationName"');
    if (!this.data.options.environmentName) grunt.warn('Missing "environmentName"');
    if (!this.data.options.region) grunt.warn('Missing "region"');
    if (!this.data.options.sourceBundle) grunt.warn('Missing "sourceBundle"');

    if (!grunt.file.isFile(this.data.options.sourceBundle))
      grunt.warn('"sourceBundle" points to a non-existent file');

    var done = this.async(),
        options = this.options({
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          s3: {
            bucket: this.data.options.applicationName,
            key: path.basename(this.data.options.sourceBoundle, path.ext(this.data.options.sourceBoundle))
          }
        }), s3, ebt;

    if (!options.accessKeyId) grunt.warn('Missing "accessKeyId"');
    if (!options.secretAccessKey) grunt.warn('Missing "secretAccessKey"');

    AWS.config.update({
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region
    });

    ebt = new AWS.ElasticBeanstalk();
    s3 = new AWS.S3();

    ebt.describeApplications({ ApplicationNames: [options.applicationName] },
        function (err, data) {
          if (err) return done(err);

          if (!data.Applications.length)
            grunt.warn('Application "' + options.applicationName + '" does not exist');

          ebt.describeEnvironments({
            ApplicationName: options.applicationName,
            EnvironmentNames: [options.environmentName]
          }, function (err, data) {
            if (err) return done(err);

            if (!data.Environments.length)
              return done(grunt.util.error('Environment "' + options.environmentName + '" does not exist'));

            var s3Object = {};

            for (var key in options.s3) {
              if (options.s3.hasOwnProperty(key)) {
                s3Object[key.substring(0, 1).toUpperCase() + key.substring(1)] =
                    options.s3[key];
              }
            }

            s3Object.Body = new Buffer(fs.readFileSync(options.sourceBundle));

            s3.putObject(s3Object, function (err, data) {
              if (err) return done(err);

              ebt.createApplicationVersion({
                ApplicationName: options.applicationName,
                VersionLabel: options.s3.key,
                SourceBundle: {
                  S3Bucket: options.s3.bucketName,
                  S3Key: options.s3.key
                }
              }, function (err, data) {
                if (err) return done(err);

                ebt.updateEnvironment({
                  EnvironmentName: options.environmentName,
                  VersionLabel: options.s3.key
                }, function (err, data) {
                  if (err) return done(err);
                  done();
                });
              })
            });
          });
        });
  });

};
