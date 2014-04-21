/*
 * grunt-awsebtdeploy
 * https://github.com/simoneb/grunt-awsebtdeploy
 *
 * Copyright (c) 2014 Simone Busoli
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {
  var fs = require('fs'),
      Zip = require('adm-zip'),
      credentials;

  try {
    credentials = require('grunt-awsebtdeploy-credentials');
  } catch (err) {
    credentials = {};
  }

  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    clean: {
      tests: ['tmp']
    },

    // Configuration to be run (and then tested).
    awsebtdeploy: {
      inPlace: {
        options: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          region: 'eu-west-1',
          deployType: 'inPlace',
          applicationName: 'awsebtdeploy-inplace',
          environmentCNAME: 'awsebtdeploy-inplace.elasticbeanstalk.com'
        }
      },
      swapToNew: {
        options: {
          accessKeyId: credentials.accessKeyId,
          secretAccessKey: credentials.secretAccessKey,
          region: 'eu-west-1',
          deployType: 'swapToNew',
          applicationName: 'awsebtdeploy-swaptonew',
          environmentCNAME: 'awsebtdeploy-swaptonew.elasticbeanstalk.com'
        }
      }
    },

    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  grunt.loadTasks('tasks');

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  grunt.registerTask('deploy', ['clean', 'bumpAppVersion', 'createSourceBundle', 'awsebtdeploy']);
  grunt.registerTask('default', ['jshint', 'deploy', 'nodeunit']);

  grunt.registerTask('bumpAppVersion', function () {
    var pkg = { version: '0.1.' + new Date().getTime() };

    fs.writeFile('app/package.json', JSON.stringify(pkg), this.async());
  });

  grunt.registerTask('createSourceBundle', function () {
    var zip = new Zip(),
        sourceBundle = 'tmp/' + require('./app/package.json').version + '.zip';

    grunt.file.mkdir('tmp');

    zip.addLocalFolder('app');
    zip.writeZip(sourceBundle);

    grunt.config('awsebtdeploy.inPlace.options.sourceBundle', sourceBundle);
    grunt.config('awsebtdeploy.swapToNew.options.sourceBundle', sourceBundle);
  });

};