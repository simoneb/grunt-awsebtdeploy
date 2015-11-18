/*
 * grunt-awsebtdeploy
 * https://github.com/simoneb/grunt-awsebtdeploy
 *
 * Copyright (c) 2014 Simone Busoli
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  var AWS    = require('aws-sdk'),
      path   = require('path'),
      fs     = require('fs'),
      get    = require('http').get,
      sget   = require('https').get,
      util   = require('util'),
      Q      = require('q'),
      mkdirp = require('mkdirp');

  function findEnvironmentByCNAME(data, cname) {
    if (!data || !data.Environments) return false;

    return data.Environments.filter(function (e) {
      return e.CNAME === cname;
    })[0];
  }

  function findEnvironmentByName(data, name) {
    if (!data || !data.Environments) return false;

    return data.Environments.filter(function (e) {
      return e.EnvironmentName === name;
    })[0];
  }

  function createEnvironmentName(applicationName) {
    var maxLength      = 23,
        time           = new Date().getTime().toString(),
        timeLength     = time.length,
        availableSpace = maxLength - applicationName.length,
        timePart       = time.substring(timeLength - availableSpace, timeLength);

    if (applicationName.length > maxLength - 3)
      grunt.log.subhead('Warning: application name is too long to guarantee ' +
          'a unique environment name, maximum length ' +
          maxLength + ' characters');

    if (/^[a-zA-Z0-9\-]+$/.test(applicationName))
      return applicationName + timePart;

    grunt.log.subhead('Notice: application name contains invalid characters ' +
        'for a environment name; stripping everything non letter, digit, or dash');
    return applicationName.replace(/[^a-zA-Z0-9\-]+/g, "") + timePart;
  }

  function wrapAWS(eb, s3) {
    return {
      describeApplications: Q.nbind(eb.describeApplications, eb),
      describeEnvironments: Q.nbind(eb.describeEnvironments, eb),
      putS3Object: Q.nbind(s3.putObject, s3),
      createApplicationVersion: Q.nbind(eb.createApplicationVersion, eb),
      updateEnvironment: Q.nbind(eb.updateEnvironment, eb),
      createConfigurationTemplate: Q.nbind(eb.createConfigurationTemplate, eb),
      swapEnvironmentCNAMEs: Q.nbind(eb.swapEnvironmentCNAMEs, eb),
      createEnvironment: Q.nbind(eb.createEnvironment, eb)
    };
  }

  function setupAWSOptions(options) {
    if (!options.accessKeyId) options.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    if (!options.secretAccessKey) options.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (!options.accessKeyId) grunt.warn('Missing "accessKeyId"');
    if (!options.secretAccessKey) grunt.warn('Missing "secretAccessKey"');

    return {
      accessKeyId: options.accessKeyId,
      secretAccessKey: options.secretAccessKey,
      region: options.region
    };
  }

  grunt.registerMultiTask('awsebtlogs', 'Retrieve logs from AWS Elastic Beanstalk', function () {
    if (!this.data.options.environmentName) grunt.warn('Missing "environmentName"');
    if (!this.data.options.region) grunt.warn('Missing "region"');

    var done = this.async(),
        options = this.options({
          outputPath: './',
          timeoutSec: 30,
          intervalSec: 2
        }),
        awsOptions = setupAWSOptions(options),
        eb         = new AWS.ElasticBeanstalk(awsOptions),
        request    = Q.nbind(eb.requestEnvironmentInfo, eb),
        retrieve   = Q.nbind(eb.retrieveEnvironmentInfo, eb),
        args       = { EnvironmentName: options.environmentName, InfoType: 'tail' };

    grunt.log.writeln('Requesting logs for environment ' + options.environmentName + '...');

    request(args)
        .then(function (data) {
          var requestId = data.ResponseMetadata.RequestId;

          function doRetrieve() {
            return Q.delay(options.intervalSec * 1000)
                .then(function () {
                  return retrieve(args);
                })
                .then(function (data) {
                  var deferred = Q.defer(),
                      found = data.EnvironmentInfo.filter(function (info) {
                        return info.BatchId === requestId;
                      });

                  if (!found || !found.length) {
                    grunt.log.writeln('Still waiting for logs...');
                    deferred.resolve(doRetrieve());
                  } else {
                    deferred.resolve(Q.all(found.map(function (info) {
                      var outputPath = path.join(options.outputPath, info.BatchId),
                          batchDeferred = Q.defer();

                      sget(info.Message, function (res) {
                        var data = [];
                        res.on('data', function (chunk) {
                          data.push(chunk);
                        });
                        res.on('end', function () {
                          mkdirp.sync(outputPath);

                          var fileName = path.join(outputPath, info.Name);
                          grunt.log.writeln('Writing log file for EC2 instance ' +
                              info.Ec2InstanceId + ' to ' + fileName);

                          fs.writeFile(fileName, data, function (err) {
                            if (err) return batchDeferred.reject(err);

                            grunt.log.ok();
                            batchDeferred.resolve();
                          });
                        });
                        res.on('error', function (err) {
                          batchDeferred.reject(err);
                        });
                      });

                      return batchDeferred.promise;
                    })));
                  }

                  return deferred.promise;
                });
          }

          return Q.timeout(doRetrieve(), options.timeoutSec * 1000);
        })
        .then(done, done);
  });

  grunt.registerMultiTask('awsebtdeploy', 'A grunt plugin to deploy applications to AWS Elastic Beanstalk', function () {

    function validateOptions() {
      if (!options.applicationName) grunt.warn('Missing "applicationName"');
      if (!options.environmentCNAME && !options.environmentName) grunt.warn('Missing "environmentCNAME" or "environmentName"');
      if (!options.region) grunt.warn('Missing "region"');
      if (!options.sourceBundle) grunt.warn('Missing "sourceBundle"');

      if (!grunt.file.isFile(options.sourceBundle))
        grunt.warn('"sourceBundle" points to a non-existent file');

      if (!options.healthPage) {
        grunt.log.subhead('Warning: "healthPage" is not set, it is recommended to set one');
      } else if (options.healthPage[0] !== '/') {
        options.healthPage = '/' + options.healthPage;
      }

      if (!options.healthPageScheme) {
        options.healthPageScheme = 'http';
      } else if (options.healthPageScheme !== 'http' && options.healthPageScheme !== 'https') {
        grunt.warn('"healthPageScheme" only accepts "http" or "https", reverting to "http"');
        options.healthPageScheme = 'http';
      }

      if (!options.versionLabel) {
        options.versionLabel = path.basename(options.sourceBundle,
            path.extname(options.sourceBundle));
      }

      if (!options.s3) {
        options.s3 = {};
      }

      if (!options.s3.bucket) {
        options.s3.bucket = options.applicationName;
      }

      if (!options.s3.key) {
        options.s3.key = path.basename(options.sourceBundle);
      }
    }

    var task    = this,
        done    = this.async(),
        options = this.options({
          versionDescription: '',
          deployType: 'inPlace',
          deployTimeoutMin: 10,
          deployIntervalSec: 20,
          healthPageTimeoutMin: 5,
          healthPageIntervalSec: 10
        }),
        awsOptions = setupAWSOptions(options),
        qAWS       = wrapAWS(new AWS.ElasticBeanstalk(awsOptions), new AWS.S3(awsOptions));

    validateOptions();

    grunt.log.subhead('Operating in region "' + options.region + '"');

    function createConfigurationTemplate(env) {
      grunt.log.write('Creating configuration template of current environment for swap deploy...');

      var templateName = options.applicationName + '-' + new Date().getTime();

      return qAWS.createConfigurationTemplate({
        ApplicationName: options.applicationName,
        EnvironmentId: env.EnvironmentId,
        TemplateName: templateName
      }).then(function (data) {
            grunt.log.ok();
            return [env, data];
          });
    }

    function createNewEnvironment(env, templateData) {
      var newEnvName = createEnvironmentName(options.applicationName);

      grunt.log.write('Creating new environment "' + newEnvName + '"...');

      return qAWS.createEnvironment({
        ApplicationName: options.applicationName,
        EnvironmentName: newEnvName,
        VersionLabel: options.versionLabel,
        TemplateName: templateData.TemplateName
      }).then(function (data) {
            grunt.log.ok();
            return [env, data];
          });
    }

    function swapEnvironmentCNAMEs(oldEnv, newEnv) {
      grunt.log.write('Swapping environment CNAMEs...');

      return qAWS.swapEnvironmentCNAMEs({
        SourceEnvironmentName: oldEnv.EnvironmentName,
        DestinationEnvironmentName: newEnv.EnvironmentName
      }).then(function () {
            grunt.log.ok();
            return oldEnv;
          });
    }

    function swapDeploy(env) {
      return createConfigurationTemplate(env)
          .spread(createNewEnvironment)
          .spread(function (oldEnv, newEnv) {
            return waitForDeployment(newEnv)
                .then(waitForHealthPage)
                .then(swapEnvironmentCNAMEs.bind(task, oldEnv, newEnv))
                .then(waitForHealthPage);
          });
    }

    function updateEnvironment(env) {
      return qAWS.updateEnvironment({
        EnvironmentName: env.EnvironmentName,
        VersionLabel: options.versionLabel,
        Description: options.versionDescription
      }).then(function () {
            grunt.log.ok();
            return env;
          });
    }

    function inPlaceDeploy(env) {
      grunt.log.write('Updating environment for in-place deploy...');

      return updateEnvironment(env)
          .then(waitForDeployment)
          .then(waitForHealthPage);
    }

    function waitForDeployment(env) {
      grunt.log.writeln('Waiting for environment to become ready (timing out in ' +
          options.deployTimeoutMin + ' minutes)...');

      function checkDeploymentComplete() {
        return Q.delay(options.deployIntervalSec * 1000)
            .then(function () {
              return qAWS.describeEnvironments({
                ApplicationName: options.applicationName,
                EnvironmentNames: [env.EnvironmentName],
                IncludeDeleted: false
              });
            })
            .then(function (data) {
              if (!data.Environments.length) {
                grunt.log.writeln(options.versionLabel + ' still not deployed to ' +
                    env.EnvironmentName + ' ...');
                return checkDeploymentComplete();
              }

              var currentEnv = data.Environments[0];

              if (currentEnv.VersionLabel !== options.versionLabel){
                grunt.log.writeln('Environment ' + currentEnv.EnvironmentName +
                    ' status: ' + currentEnv.Status + '...');
                return checkDeploymentComplete();
              }

              if (currentEnv.Status !== 'Ready') {
                grunt.log.writeln('Environment ' + currentEnv.EnvironmentName +
                    ' status: ' + currentEnv.Status + '...');
                return checkDeploymentComplete();
              }

              if (currentEnv.Health !== 'Green') {
                grunt.log.writeln('Environment ' + currentEnv.EnvironmentName +
                    ' health: ' + currentEnv.Health + '...');
                return checkDeploymentComplete();
              }

              grunt.log.writeln(options.versionLabel + ' has been deployed to ' +
                  currentEnv.EnvironmentName + ' and environment is Ready and Green');

              return currentEnv;
            });
      }

      return Q.timeout(checkDeploymentComplete(), options.deployTimeoutMin * 60 * 1000);
    }

    function waitForHealthPage(env) {
      if (!options.healthPage) {
        return;
      }

      function checkHealthPageStatus() {
        grunt.log.write('Checking health page status...');

        var deferred = Q.defer();

        var checkHealthPageRequest = {
          hostname: env.CNAME,
          path: options.healthPage,
          headers: {
            'cache-control': 'no-cache'
          }
        };
        var checkoutHealthPageCallback = function (res) {
          if (res.statusCode === 200) {
            grunt.log.ok();
            deferred.resolve(res);
          } else {
            grunt.log.writeln('Status ' + res.statusCode);
            deferred.resolve(
              Q.delay(options.healthPageIntervalSec * 1000)
               .then(checkHealthPage));
          }
        };
        if (options.healthPageScheme === 'https') {
          //Necessary because ELB's security certificate won't be valid yet.
          checkHealthPageRequest.rejectUnauthorized = false;
          sget(checkHealthPageRequest, checkoutHealthPageCallback);
        } else {
          get(checkHealthPageRequest, checkoutHealthPageCallback);
        }

        return deferred.promise;
      }

      function checkHealthPageContents(res) {
        var body,
            deferred = Q.defer();

        if (!options.healthPageContents) return;

        grunt.log.write('Checking health page contents against ' +
            options.healthPageContents + '...');

        res.setEncoding('utf8');

        res.on('data', function (chunk) {
          if (!body) body = chunk;
          else body += chunk;
        });
        res.on('end', function () {
          var ok;

          if (util.isRegExp(options.healthPageContents)) {
            ok = options.healthPageContents.test(body);
          } else {
            ok = options.healthPageContents === body;
          }

          if (ok) {
            grunt.log.ok();
            deferred.resolve();
          } else {
            grunt.log.error('Got ' + body);
            deferred.resolve(
                Q.delay(options.healthPageIntervalSec * 1000).then(checkHealthPage));
          }
        });

        return deferred.promise;
      }

      function checkHealthPage() {
        return checkHealthPageStatus()
            .then(checkHealthPageContents);
      }

      grunt.log.writeln('Checking health page of ' + env.CNAME +
          ' (timing out in ' + options.healthPageTimeoutMin + ' minutes)...');

      return Q.timeout(checkHealthPage(), options.healthPageTimeoutMin * 60 * 1000);
    }

    function invokeDeployType(env) {
      switch (options.deployType) {
        case 'inPlace':
          return inPlaceDeploy(env);
        case 'swapToNew':
          return swapDeploy(env);
        case 'manual':
          return;
        default:
          grunt.warn('Deploy type "' + options.deployType + '" unrecognized');
      }
    }

    function createApplicationVersion(env) {
      grunt.log.write('Creating application version "' + options.versionLabel + '"...');

      return qAWS.createApplicationVersion({
        ApplicationName: options.applicationName,
        VersionLabel: options.versionLabel,
        Description: options.versionDescription,
        SourceBundle: {
          S3Bucket: options.s3.bucket,
          S3Key: options.s3.key
        }
      }).then(function () {
            grunt.log.ok();
            return env;
          });
    }

    function uploadApplication(env) {
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

      return qAWS.putS3Object(s3Object)
          .then(function () {
            grunt.log.ok();
            return env;
          });
    }

    function checkEnvironmentExists() {
      if(options.environmentName)
        grunt.log.write('Checking that environment with name "' + options.environmentName + '" exists...');
      else
        grunt.log.write('Checking that environment with CNAME "' + options.environmentCNAME + '" exists...');

      return qAWS.describeEnvironments({
        ApplicationName: options.applicationName,
        IncludeDeleted: false
      }).then(function (data) {
            grunt.verbose.writeflags(data, 'Environments');

            var env = null;
            if(options.environmentName)
              env = findEnvironmentByName(data, options.environmentName);
            else
              env = findEnvironmentByCNAME(data, options.environmentCNAME);

            if (!env) {
              var name = options.environmentName ? options.environmentName : options.environmentCNAME;
              if (options.deployType === 'manual') {
                grunt.log.write('Environment "' + name + '" does not exist but is not required for manual deployment');
              } else {
                grunt.log.error();
                grunt.warn('Environment "' + name + '" does not exist');
              }
            }

            grunt.log.ok();
            return env;
          });
    }

    function checkApplicationExists() {
      grunt.log.write('Checking that application "' + options.applicationName + '" exists...');

      return qAWS.describeApplications({ ApplicationNames: [options.applicationName] })
          .then(function (data) {
            grunt.verbose.writeflags(data, 'Applications');

            if (!data.Applications.length) {
              grunt.log.error();
              grunt.warn('Application "' + options.applicationName + '" does not exist');
            }

            grunt.log.ok();
          });
    }

    return checkApplicationExists()
        .then(checkEnvironmentExists)
        .then(uploadApplication)
        .then(createApplicationVersion)
        .then(invokeDeployType)
        .then(done, done);
  });
};
