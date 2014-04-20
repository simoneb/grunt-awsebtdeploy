# grunt-awsebtdeploy

> A grunt plugin to deploy applications to AWS Elastic Beanstalk

This plugin automates uploading of a _sourceBundle_ to S3 and update an Elastic Beanstalk
environment with the new version of your application.
It **does not** handle creating environments, applications or S3 buckets, so they have
to exist in advance.

## Getting Started
This plugin requires Grunt `~0.4.4`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-awsebtdeploy --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-awsebtdeploy');
```

## The "awsebtdeploy" task

### Overview
In your project's Gruntfile, add a section named `awsebtdeploy` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  awsebtdeploy: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

### Options

#### options.applicationName
Required

Type: `String`

The name of the Elastic Beanstalk application.

#### options.environmentName
Required

Type: `String`

The name of the Elastic Beanstalk environment.

#### options.region
Required

Type: `String`

The name of the AWS region. It applies to both S3 buckets and Elastic Beanstalk.

#### options.sourceBundle
Required

Type: `String`

The path of a [valid](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.deployment.source.html) sourceBundle archive on the file system.
This needs to be created in advance, for instance with `git archive --format zip`.

#### options.versionLabel
Type: `String`

Default: `option.sourceBundle` file name without the extension

The label of the application version as it appears in Elastic Beanstalk.

#### options.accessKeyId
Type: `String`

Default: `process.env.process.env.AWS_ACCESS_KEY_ID`

The AWS access key id. If not provided explicitly it is taken from the environment variable.

#### options.secretAccessKey
Type: `String`

Default: `process.env.process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key. If not provided explicitly it is taken from the environment variable.

#### options.wait
Type: `Boolean`

Default: `false`

Specifies whether to wait to terminate until the environment successfully restarts after
the update. It corresponds to checking that the new version of the application is deployed
and that the environment is in state ready and health green.

#### options.s3
Type: `Object`

Default: `{ bucket: options.applicationName, key: path.basename(options.sourceBundle) }`

An object containing the configuration options for the S3 bucket where `options.sourceBundle`
is uploaded. Is accepts all options (camelCase instead of PascalCase though)
as the AWS S3 SDK `putObject` operation, as described [here](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property).

### Usage Examples

```js
grunt.initConfig({
  awsebtdeploy: {
    demo: {
      options: {
        region: 'eu-west-1',
        applicationName: 'awsebtdeploy-demo',
        environmentName: 'awsebtdeploy-demo-env',
        accessKeyId: "your access ID",
        secretAccessKey: "your secret access key",
        sourceBundle: "path/to/source/bundle.zip"
        wait: true
      }
    }
  }
});
```