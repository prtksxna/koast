# What is a Koast app?

Koast provides a base for a backend server to support an AngularJS app. (It may be useful for Javascript apps built with other frameworks as well, but our focus is on Angular.) The goal is to quickly setup a server that would take care of things that a typical AngularJS app would need (such as configuration, authentication, and database access) without resorting to code generation.

Koast consists of two parts:

A server side npm module "koast", which you can install with npm install koast. This module allows you to create a server. In a typical case, you would write a few lines of code to instantiate and start a server, defining most of the functionality through configuration files, a schema file, and a module implementing the API.

A client-side bower package "koast-angular", which you can install with bower install koast-angular. This provides an AngularJS module that helps your frontend app talk to the backend server. You don't have to use it: if you prefer you can just talk to the server directly. However, the frontend module might save you a bit of time.

# Koast quick start

To get koast up and running quickly, just run `koast init`, it will then prompt you to select some basic configuration for your app.

```
  _                   _
 | | _____   __ _ ___| |_
 | |/ / _ \ / _` / __| __|
 |   < (_) | (_| \__ \ |_
 |_|\_\___/ \__,_|___/\__| Is now initializing your app <3

? Package name: koast-app
? Description: A koast app
? Include frontend: Yes
? Include default gulpfile: Yes
```


Which will create this file structure:


```
├── bower_components -- only if 'include front end'
├── client           -- only if 'include front end'
├── config
│   ├── app.json     -- global configuration
│   └── dev
|     └── dev.json
├── server
|   ├── app.js       -- server application
|   └── api.js       -- example api
└── gulpfile.js      -- only if 'include default gulpfile'
```



Koast has a high level of customization when it comes to loading configuration files. The init process will create a default `config/app.json` that your app will use to bootstrap itself.
*Note*, for a quick-start (or for testing) you can explicitly set your configuration within your `app.js` file


```javascript
/* app.js */
var koast = require('koast');
var appSettings = {
  'app': {
    'indexHtml': 'path:../client/index.html',
    'portNumber': 8081,
    'routes': [{
      'route': '/api/v1',
      'type': 'module',
      'module': 'server/lib/api'
    }]
  },
  'databases': [{
    'host': '127.0.0.1',
    'port': '27017',
    'db': 'erg',
    'schemas': './server/schemas.js',
    'handle': '_'
  }]
};

koast.configure({
  appConfiguration: appSettings
});
koast.serve();
```

To quickly create api end-points with a MongoDB backend, an application can use the koast mongo-mapper. To use mongo-mapper, simply create a schema file like below:

```javascript
/* schemas .js */
exports.schemas = [{
  // Represents a task.
  name: 'tasks',
  properties: {
    taskId: Number,
    owner: String,
    description: String
  }
}];

```

and define a koast module to setup your routes:

```javascript
/* lib/api.js */
/* global require */

'use strict';

var koast = require('koast');
var koastRouter = koast.koastRouter;
var connection = koast.db.getConnectionNow();
var mapper = koast.mongoMapper.makeMapper(connection);

var defaults = {
  authorization: function (req, res) {
    return true;
  }
};

mapper.options.useEnvelope = false;

var routes = [{
  method: 'get',
  route: 'tasks',
  handler: mapper.get({
    model: 'tasks'
  })
}, {
  method: ['get', 'put', 'post', 'delete'],
  route: 'tasks/:_id',
  handler: mapper.auto({
    model: 'tasks'
  })
}];

module.exports = exports = {
  koastModule: {
    defaults: defaults,
    router: koastRouter(routes, defaults)
  }
};

```

When running this application with node server/app.js, you will have a quick CRUD application setup for your tasks schema.

# Further Reading ...

More in depth documentation is available [at rangle.github.io/koast-documentation](http://rangle.github.io/koast-documentation). This documentation goes into more details about how to configure koast, the features supported and the other modules that are available.


- [Basics](http://http://rangle.github.io/koast-documentation/documentation/basics/getting-started.html)
  - [Getting Started](http://rangle.github.io/koast-documentation/documentation/basics/getting-started.html#getting-started)
  - [Koast Init](http://rangle.github.io/koast-documentation/documentation/basics/getting-started.html#koast-init)
  - [Manual Creation](http://rangle.github.io/koast-documentation/documentation/basics/getting-started.html#manual-creation)
- [Configuration](http://rangle.github.io/koast-documentation/documentation/configuration/index.html)
  - [App Configuration](http://rangle.github.io/koast-documentation/documentation/configuration/app-configuration.html)
  - [Authentication Configuration](http://rangle.github.io/koast-documentation/documentation/configuration/authentication-configuration.html)
  - [Database Configuration](http://rangle.github.io/koast-documentation/documentation/configuration/database-configuration.html)
- [Authentication](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html)
  - [Authentication Options](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html#authentication-options)
  - [Example Projects](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html#example-projects)
  - [Password - Tokens](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html#password---tokens)
  - [OAuth Setup](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html#oauth-setup)
  - [OAuth Tokens](http://rangle.github.io/koast-documentation/documentation/authentication/authentication.html#oauth---tokens)
- [Setting up Routes](http://rangle.github.io/koast-documentation/documentation/routing/setting-up-routes.html)
  - [Static Routes](http://rangle.github.io/koast-documentation/documentation/routing/setting-up-routes.html#static)
  - [Module Routes](http://rangle.github.io/koast-documentation/documentation/routing/setting-up-routes.html#module)
  - [Migrating older Koast Routes](http://rangle.github.io/koast-documentation/documentation/routing/setting-up-routes.html#migrating-older-koast-applications)
- [Mongo Mapper](http://rangle.github.io/koast-documentation/documentation/mongo-mapper/mongo-mapper.html)
  - [Basic Usage](http://rangle.github.io/koast-documentation/documentation/mongo-mapper/mongo-mapper.html#basic-usage)
  - [Annotators](http://rangle.github.io/koast-documentation/documentation/mongo-mapper/mongo-mapper.html#annotators)

