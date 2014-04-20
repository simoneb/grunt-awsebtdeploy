# grunt-awsebtdeploy

> A grunt plugin to deploy applications to AWS Elastic Beanstalk

This plugin automates uploading an application _sourceBundle_ to S3 and update an Elastic Beanstalk
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

These are the supported options. A trailing __*__ indicates a mandatory option.

##### `String` options.applicationName *

The name of the Elastic Beanstalk application.  
It must exist and be accessible with the provided authorization tokens, otherwise an error is raised.

##### `String` options.environmentName *

The name of the Elastic Beanstalk environment.  
It must exist and be accessible with the provided authorization tokens, otherwise an error is raised.

##### `String` options.region *

The [AWS region](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region), for example `us-east-1`.  
This setting applies to all resources handled by the task, S3 and Elastic Beanstalk.

##### `String` options.sourceBundle *

The path to a valid [source bundle](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.deployment.source.html) 
archive on the local file system.  
The archive needs to be created in advance, for instance with `git archive --format zip`.

##### `String` options.versionLabel 

The label of the application version as it appears in Elastic Beanstalk.  

*Default*: `options.sourceBundle` file name without the extension

##### `String` options.versionDescription

The description of the application version as it appears in Elastic Beanstalk.

*Default*: `""` - empty string

##### `String` options.accessKeyId

The AWS access key id.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

*Default*: `process.env.AWS_ACCESS_KEY_ID`

##### `String` options.secretAccessKey

*Default*: `process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

##### `Boolean` options.wait

Specifies whether to wait to terminate until the environment successfully restarts after
the update. It corresponds to checking that the new version of the application is deployed
and that the environment is in state ready and health green.

*Default*: `false`

##### `Object` options.s3

An object containing the configuration options for the S3 bucket where `options.sourceBundle`
is uploaded. Is accepts all options 
as the AWS S3 SDK `putObject` operation, as described [here](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property), 
but in _camelCase_ format instead of _PascalCase_.  
All settings are optional except `bucket` and `key`, which have sensible defaults.

*Default*: 

```js
{ 
  bucket: options.applicationName, 
  key: path.basename(options.sourceBundle) 
}```

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
        sourceBundle: "path/to/source/bundle.zip",
        wait: true
      }
    }
  }
});
```