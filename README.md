# grunt-awsebtdeploy
[![Build Status](https://travis-ci.org/simoneb/grunt-awsebtdeploy.svg?branch=master)](https://travis-ci.org/simoneb/grunt-awsebtdeploy)
[![NPM version](https://badge.fury.io/js/grunt-awsebtdeploy.svg)](http://badge.fury.io/js/grunt-awsebtdeploy)
[![Dependency Status](https://david-dm.org/simoneb/grunt-awsebtdeploy.svg)](https://david-dm.org/simoneb/grunt-awsebtdeploy)

> A grunt plugin to deploy applications to AWS Elastic Beanstalk

This plugin contains a set of *Grunt* tasks to automate the deployment and management of applications running on the Amazon Web Services Elastic Beanstalk service.

It relies on the the official [AWS SDK for Node.js](aws.amazon.com/sdkfornodejs/) to communicate with AWS.

## Getting Started

This plugin requires Grunt `~0.4.x`. If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide.  

You may install this plugin with this command:

```shell
npm install grunt-awsebtdeploy --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-awsebtdeploy');
```

## Environment Tiers

This plugin was created with the idea of managing applications running in [Web Tiers](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features-managing-env-tiers.html). Which environment tiers each task supports is described in the task documentation section.

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

These are the supported options. A __*__ indicates a mandatory option.

##### options.applicationName *

* Type: `String`

The name of the Elastic Beanstalk application.  
It must exist and be accessible with the provided AWS authorization tokens.

##### options.environmentCNAME *

* Type: `String`

The CNAME of the Elastic Beanstalk environment.  
This is the host name of the url normally used to access the application, for example `myapp.elasticbeanstalk.com`.  
It must exist and be accessible with the provided AWS authorization tokens.

options.environmentCNAME is mandatory if options.environmentName not set

##### options.environmentName *

* Type: `String`

The name of the Elastic Beanstalk environment.  
It must exist and be accessible with the provided AWS authorization tokens.

options.environmentName is mandatory if options.environmentCNAME not set

##### options.region *

* Type: `String`

The [AWS region](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region), for example `us-east-1`.  
This setting applies to all resources handled by the task, currently S3 and Elastic Beanstalk.

##### options.sourceBundle *

* Type: `String`

The path to a valid [source bundle](http://docs.aws.amazon.com/elasticbeanstalk/latest/dg/using-features.deployment.source.html)
archive on the local file system.  
The archive needs to be created in advance of running the task, for instance with `git archive --format zip`.

##### options.deployType

* Type: `String`
* Default: `inPlace`  
* Allowed values: `inPlace`, `swapToNew`, `manual`

The type of the deployment to run, more on this below.

##### options.versionLabel

* Type: `String`
* Default: `options.sourceBundle` file name without the extension

The label of the application version as it appears in Elastic Beanstalk.  

##### options.versionDescription

* Type: `String`
* Default: `""` - empty string

The description of the application version as it appears in Elastic Beanstalk.

##### options.accessKeyId

* Type: `String`
* Default: `process.env.AWS_ACCESS_KEY_ID`

The AWS access key id.  
If not provided explicitly it is taken from the corresponding environment variable.

##### options.secretAccessKey

* Type: `String`
* Default: `process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key.  
If not provided explicitly it is taken from the corresponding environment variable.

##### options.healthPage

* Type: `String`

A path, relative to the environment URL, to check for a `200 OK` status code with a HTTP GET request after a deployment.  
If not set the check is skipped.

##### options.healthPageContents

* Type: `String`, `RegExp`

A string or a regular expression to match against the body of any response returned by `options.healthPage`.  If `options.healthPage` is not set this option is ignored.   
Strings are matched with `===` whereas regular expressions
are matched with `RegExp.test`.

##### options.healthPageScheme

* Type: `String`
* Default: `http`

The URI scheme to use when loading the `options.healthPage`, accepts either `http` or `https`.  If `options.healthPage` is not set this option is ignored.   
If set to `https`, the security certificate is ignored since the CNAME would not match the provided certificate.

##### options.deployTimeoutMin

* Type: `Number`
* Default: `10`

Number of minutes after which a deployment operation times out.  
A deployment is considered complete when the environment goes back to a Green and Ready state after a new version
of the application has been deployed.

##### options.deployIntervalSec

* Type: `Number`
* Default: `20`

Number of seconds between failed attempts to check the outcome of a deployment.

##### options.healthPageTimeoutMin

* Type: `Number`
* Default: `5`

Number of minutes after which checking the health page times out.  
This option is meaningful only in case `options.healthPage` is set.

##### options.healthPageIntervalSec

* Type: `Number`
* Default: `10`

Number of seconds between failed attempts to check the health page status and optionally its contents.

##### options.s3

* Type: `Object`
* Default:
```js
{
    bucket: options.applicationName,  
    key: path.basename(options.sourceBundle)
}
```

An object containing the configuration options of the S3 bucket where
`options.sourceBundle` is uploaded.  
It accepts the same options as the [AWS S3 SDK
`putObject` operation](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property),
just in _camelCase_ rather than _PascalCase_.

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

Some options may need to be generated dynamically, especially for those settings that must be unique in AWS, like object keys in S3 (per bucket) and Elastic Beanstalk application versions (per application).

By default the S3 object key as well as the EBT `versionLabel` are derived from `sourceBundle` (its basename), which means that as long as the file name pointed to by `sourceBundle` does not collide with existing S3 object keys or Elastic Beanstalk application versions all is good.  
The rationale behind this design decision is that we imagine that the `sourceBundle` archive is generated using a mechanism similar to:

```shell
git describe ...
git archive ...
```

which, depending on the passed flags, can generate meaningful and unique names for the resulting archive.

Once you have a sensible value for `sourceBundle` setting it into the task/target options is a matter of relying on *grunt* utility functions to set configuration options dynamically using a *dotted* notation.

This snippet of code for example could be run in a custom task before the `awsebtdeploy` task:

```js
var sourceBundle = 'path/to/source/bundle.zip';
grunt.config('awsebtdeploy.demo.options.sourceBundle', sourceBundle);
```

## Health check

After a deployment is operationally complete it is possible to check and wait until a request to a health page running in the target environment returns a success status code and optionally that its contents match a string or a regular expression.

Configuring a health page, which is a path relative to the environment's _CNAME_, is optional but strongly recommended as it provides additional guarantees about the outcome of a deployment. The results of the operations carried out by the plugin via the AWS SDK only guarantee that the operation itself has succeded but cannot ensure that the application is functioning correctly or that the new version of the application is already running.  
As an example, a failed deployment due to AWS issues may be automatically rolled back by Elastic Beanstalk to a previous version of the application, therefore without checking a health page which optionally exposes version information it would be tricky to detect that the new version is in fact not running.

Regardless of specific issues this is normally useful when doing a `swapToNew` deployment, whereby a change in the DNS might take time to propagate.

A health check can be configured using three options: `options.healthPage`, `options.healthPageContents` and `options.healthPageScheme`. Its behavior differs depending on the deployment type, described next.

## Deployment types

Three deployment types are supported, which can be configured in the task options.
There is a common sequence of internal operations followed by all deployment types, which correspond to
[AWS SDK operations](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/frames.html).

1. `describeApplications` to check that `options.applicationName` exists
2. `describeEnvironments` to check that `options.environmentCNAME` or `options.environmentName` exists
3. `S3.putObject` to upload `options.sourceBundle` to S3
4. `createApplicationVersion` to create a new application version from the S3 object
5. _any deployment type-specific logic, described below_

### `inPlace`

The deploy is done to the currently running environment, therefore a downtime will happen while the
environment refreshes after the update.

The specific operations are:

1. `updateEnvironment` to configure the environment to use the new application version
2. `describeEnvironments` recursively to check that the existing environment is up and running
3. if `options.healthPage` is set a HTTP GET request is issued to the corresponding URL until the response status
code is 200 and, if `options.healthPageContents` is set, until the body of the response matches. This basically guarantees that in the first case the application is up, and in the second that the deployment is complete when the health page responds with a string matching `options.healthPageContents`, which might carry version information

> This deployment type is safe for non-production environments where there is no need to guarantee uptime

### `swapToNew`

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

### `manual`

Manual deployment. The source bundle will be uploaded to S3, and a new application version will be ready and waiting to be deployed.


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

These are the supported options. A __*__ indicates a mandatory option.

##### options.environmentName *

* Type: `String`

The name of the Elastic Beanstalk environment.  
It must exist and be accessible with the provided AWS authorization tokens.

##### options.outputPath *

* Type: `String`

The path on the file system where log files are saved.
If the path does not exist it is created with `mkdirp`.

##### options.region *

* Type: `String`

The [AWS region](http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region), for example `us-east-1`.  

##### options.accessKeyId

* Type: `String`
* Default: `process.env.AWS_ACCESS_KEY_ID`

The AWS access key id.  
If not provided explicitly it is taken from the corresponding environment variable.

##### options.secretAccessKey

* Type: `String`
* Default: `process.env.AWS_SECRET_ACCESS_KEY`

The AWS secret access key.  
If not provided explicitly it is taken from the corresponding environment variable.

##### options.timeoutSec

* Type: `Number`
* Default: `30`

Number of seconds after which the log retrieval operation times out.

##### options.intervalSec

* Type: `Number`
* Default: `2`

Number of seconds between attempts to check log availability.

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
* 2014-08-05	    v0.1.11	Support SSL-only ELB instances, ensure environment names contain legit characters
* 2014-05-27	    v0.1.10	Add new "manual" deploy type
* 2014-05-17	    v0.1.9	    Use options.versionDescription when creating an application version
* 2014-05-09	    v0.1.8    	Target options correctly override task options. Update dependencies
* 2014-05-02	    v0.1.7	    Add timeout and interval options to logs task, and deploy/health page deploy task
