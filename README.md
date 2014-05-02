# grunt-awsebtdeploy 
[![Build Status](https://travis-ci.org/simoneb/grunt-awsebtdeploy.svg?branch=master)](https://travis-ci.org/simoneb/grunt-awsebtdeploy) 
[![NPM version](https://badge.fury.io/js/grunt-awsebtdeploy.svg)](http://badge.fury.io/js/grunt-awsebtdeploy)
[![Dependency Status](https://david-dm.org/simoneb/grunt-awsebtdeploy.svg)](https://david-dm.org/simoneb/grunt-awsebtdeploy)

> A grunt plugin to deploy applications to AWS Elastic Beanstalk

This plugin contains a set of *Grunt* tasks to automate the deployment and management of applications running on the Amazon Web Services Elastic Beanstalk service.

It relies on the the official [AWS SDK for Node.js](aws.amazon.com/sdkfornodejs/) to interact with AWS.

## Getting Started

This plugin requires Grunt `~0.4.4`. If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide.  

You may install this plugin with this command:

```shell
npm install grunt-awsebtdeploy --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-awsebtdeploy');
```

## Environment Tiers

This plugin was created with the idea of managing applications running in [Web Tiers](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features-managing-env-tiers.html). Which environment tiers a particular task supports is described in each task documentation section below.

## The **awsebtdeploy** task

> Supported environment tiers: **Web**

### Overview
In your project's Gruntfile, add a section named `awsebtdeploy` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  awsebtdeploy: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific options go here.
    },
  },
});
```

### Options

These are the supported options. A trailing __*__ indicates a mandatory option.

##### options.applicationName *

* Type: `String` 

The name of the Elastic Beanstalk application.  
It must exist and be accessible with the provided authorization tokens, otherwise an error is raised.

##### options.environmentCNAME *

* Type: `String` 

The CNAME of the Elastic Beanstalk environment.
This is the url normally used to access the application, for example `myapp.elasticbeanstalk.com`.
It must exist and be accessible with the provided authorization tokens, otherwise an error is raised.

##### options.region *

* Type: `String` 

The [AWS region](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region), for example `us-east-1`.  
This setting applies to all resources handled by the task, S3 and Elastic Beanstalk.

##### options.sourceBundle *

* Type: `String` 

The path to a valid [source bundle](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.deployment.source.html) 
archive on the local file system.  
The archive needs to be created in advance, for instance with `git archive --format zip`.

##### options.deployType

* Type: `String` 
* Default: `inPlace`  
* Allowed values: `inPlace` | `swapToNew`

The type of the deployment to perform.

##### options.versionLabel 

* Type: `String`
* Default: `options.sourceBundle` file name without the extension

The label of the application version as it appears in Elastic Beanstalk.  

##### options.versionDescription

* Type: `String`
* Default: `""` (empty string)

The description of the application version as it appears in Elastic Beanstalk.

##### options.accessKeyId

* Type: `String`
* Default: `process.env.AWS_ACCESS_KEY_ID`

The AWS access key id.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

##### options.secretAccessKey

* Type: `String` 
* Default: `process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

##### options.healthPage

* Type: `String`

A path, relative to the environment URL, to check for a `200 OK` status code with a HTTP GET after a deployment.  
If not set the check will be skipped.

##### options.healthPageContents

* Type: `String` | `RegExp`

A string or a regular expression to match with the body of any response from the `options.healthPage`.  
If `options.healthPage` is not set this option is ignored. Strings are matched with `===` whereas regular expressions 
are matched with `RegExp.test`.

##### options.deployTimeoutMin

* Type: `Number` 
* Default: `10`

Time number of minutes after which a deploy operation times out.  
A deployment is considered complete when the environment goes back to a Green and Ready state after a new version
of an application has been deployed.

##### options.deployIntervalSec

* Type: `Number` 
* Default: `20`

Time number of seconds between attempts to check the outcome of a deployment.

##### options.healthPageTimeoutMin

* Type: `Number` 
* Default: `5`

Time number of minutes after which the check of a health page times out.  
This option is meaningful only in case `options.healthPage` and optionally `options.healthPageContents` have been specified.

##### options.healthPageIntervalSec

* Type: `Number` 
* Default: `10`

Time number of seconds between attempts to check a health page status and optionally its contents.

##### options.s3

* Type: `Object`
* Default: 
```js
{ 
    bucket: options.applicationName,  
    key: path.basename(options.sourceBundle) 
}
```

An object containing the configuration options for the S3 bucket where
`options.sourceBundle` is uploaded.  
It accepts all options as the [AWS S3 SDK
`putObject` operation](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property),
just in _camelCase_ rather than _PascalCase_.

All settings are optional except `bucket` and `key`, which have sensible defaults.

> `bucket` must refer to an existing and accessible bucket

## Usage Examples

```js
grunt.initConfig({
  awsebtdeploy: {
    demo: {
      options: {
        region: 'eu-west-1',
        applicationName: 'awsebtdeploy-demo',
        environmentCNAME: 'awsebtdeploy-demo.elasticbeanstalk.com',
        sourceBundle: "path/to/source/bundle.zip"
        // or via the AWS_ACCESS_KEY_ID environment variable
        accessKeyId: "your access ID",
        // or via the AWS_SECRET_ACCESS_KEY environment variable
        secretAccessKey: "your secret access key",
      }
    }
  }
});
```

#### Setting properties dynamically

A common scenario is to generate option names dynamically, especially for those settings that must be unique in AWS, like object keys in S3 (per bucket) and EBT application versions (per application).

By default the S3 object key as well as the EBT `versionLabel` are derived from `sourceBundle` (its basename only), which means that as long as the file name pointed to by `sourceBundle` does not collide with existing S3 object keys or EBT application versions all is good.  
The rationale behind this design decision is that we imagine that the `sourceBundle` archive is generated using a mechanism similar to:

```shell
git describe [...]
git archive [...]
```

which, depending on the passed flags, can generate meaningful names for the resulting archive.

Once you have a sensible value for `sourceBundle` setting it into the task/target options is a matter of relying on *grunt*, which provides utility functions to set configuration options using a *dotted* notation:

```js
var sourceBundle = 'path/to/source/bundle.zip';
grunt.config('awsebtdeploy.demo.options.sourceBundle', sourceBundle);
```

This snippet of code could be run for example in a custom task before the `awsebtdeploy` task.

## Health check

After a deployment is operationally complete it is possible to check and wait until a request to a health page running in the target environment returns a success status code and optionally that its contents match a string or a regular expression.

Configuring a health page, a path relative to the environment's _CNAME_, is optional but strongly recommended as it provides additional guarantees about the outcome of a deployment. The results of operations done via the AWS SDK only guarantee that the operation itself has succeded but cannot ensure that the application is functioning correctly or that the new version of the application is already running.

This is especially useful when doing a `swapToNew` deployment, whereby a change in the DNS might take time to propagate.

A health check can be configured using two options: `options.healthPage` and `options.healthPageContents` and its behavior differes depending on the deployment type, described next.

## Deployment types

Two deployment types are supported, which can be configured in the task options. 
There is a common sequence of internal operations followed by all deployment types, which correspond to 
[AWS SDK operations](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/frames.html).

1. `describeApplications` to check that `options.applicationName` exists
2. `describeEnvironments` to check that `options.environmentCNAME` exists
3. `S3.putObject` to upload `options.sourceBundle` to S3
4. `createApplicationVersion` to create a new application version from the S3 object
5. _any deployment type-specific logic, described below_

### inPlace

The deploy is done to the currently running environment, therefore a downtime will happen while the
environment refreshes after the update.

The specific operations are:

1. `updateEnvironment` to configure the environment to use the new application version
2. `describeEnvironments` recursively to check that the existing environment is up and running
3. if `options.healthPage` is set a HTTP GET request is issued to the corresponding URL until the response status
code is 200 and, if `options.healthPageContents` is set, until the body of the response matches. This basically guarantees that in the first case the application is up, and in the second that the deployment is complete when the health page responds with a string matching `options.healthPageContents`, which might carry version information

> This deployment type is safe for non-production environments where there is no need to guarantee uptime

### swapToNew 

A flavor of *blue/green* deployment where a new environment is created with the same settings as the current one, 
the application is deployed to the new environment and finally the CNAMEs of the environments are swapped 
so that the old environment url now points to the new one. 
This method enables zero-downtime deployments and the procedure 
is described in the [AWS documentation](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.CNAMESwap.html).

> The old environment is not terminated automatically for safety reasons, to avoid leaving old environments running
they should be terminated manually.  
> Creating a new environment is a lengthy operation that may take up to several minutes

The specific operations are:

1. `createConfigurationTemplate` to create a template of the configuration of the current environment to be used for 
the new environment. The template is given an autogenerated name
2. `createEnvironment` to create a new environment based on the previous template, containing the new application version.
The environment is given an autogenerated name
3. `describeEnvironments` recursively to check that the new environment is up and running
4. If `options.healthPage` is set a HTTP GET request is issued to the corresponding temporary URL **in the new environment** until the response status code is 200 and, if `options.healthPageContents` is set, until the body of the response matches. This guarantees that the new version of the application is running in the new environment before swapping the CNAME with the original environment
5. `swapEnvironmentCNAMEs` to swap the urls of the old and new environments so that the new environment starts responding
to requests made to the old environment url
6. If `options.healthPage` is set a HTTP GET request is issued to the corresponding **original** URL until the response status code is 200 and, if `options.healthPageContents` is set, until the body of the response matches too.  
  This step, in combination with `options.healthPageContents`, guarantees that if this options is set to a value which is unique to the new version of the application, like a VCS changeset, and if the health page returns that version-specific value, a deployment is considered complete when the changes due to the CNAME swap have fully propagated. In the other case the plugin would consider the deployment complete even though the old environment might be still serving requests at the original url for some time after the swap


> This deployment type is more appropriate for production environments, but compared to `inPlace` it creates new resources and can potentially disrupt the functionality of the environment in case any step goes wrong, which would require manual intervention, for example to swap CNAMEs again to the old, untouched environment    


## The **awsebtlogs** task

> Supported environment tiers: **All**

### Overview
This task automates requesting and then retrieving log files for all instances running within an environment.

Note that log retrieval is an asynchronous operation, triggered by an initial request and followed by a periodic check of the availability of the requested information.

In your project's Gruntfile, add a section named `awsebtlogs` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  awsebtlogs: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific options go here.
    },
  },
});
```

### Options

These are the supported options. A trailing __*__ indicates a mandatory option.

##### options.environmentName *

* Type: `String` 

The name of the Elastic Beanstalk environment.  
It must exist and be accessible with the provided authorization tokens, otherwise an error is raised.

##### options.outputPath *

* Type: `String` 

The path on the file system where log files are saved.
If the path does not exist it is created with `mkdirp`.

##### options.region *

* Type: `String` 

The [AWS region](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region), for example `us-east-1`.  
This setting applies to all resources handled by the task, S3 and Elastic Beanstalk.

##### options.accessKeyId

* Type: `String`
* Default: `process.env.AWS_ACCESS_KEY_ID`

The AWS access key id.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

##### options.secretAccessKey

* Type: `String` 
* Default: `process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key.  
If not provided explicitly it is taken from the environment variable, but it needs to be set one way or another.

##### options.timeoutSec

* Type: `Number` 
* Default: `30`

Time number of seconds after which the log retrieval operation times out.

##### options.intervalSec

* Type: `Number` 
* Default: `2`

Time number of seconds between attempts to check log availability.

## Usage Examples

```js
grunt.initConfig({
  awsebtlogs: {
    logs: {
      options: {
        // or via the AWS_ACCESS_KEY_ID environment variable
        accessKeyId: "your access ID",
        // or via the AWS_SECRET_ACCESS_KEY environment variable
        secretAccessKey: "your secret access key"
        region: 'eu-west-1',
        environmentName: 'awsebtdeploy-demo',
        outputPath: 'logs',
        timeoutSec: 20,
        intervalSec: 5
      }
    }
  }
});
```

## Release History

 * 2014-05-02   v0.1.7   Add timeout and interval options to logs task, and deploy/health page deploy task
 