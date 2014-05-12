/* global require, exports */

'use strict';

var _ = require('underscore');
var passport = require('passport');
var express = require('express');
var connectMongo = require('connect-mongo');
var MongoStore = connectMongo(express);

var config = require('../config');
var log = require('../log');
var oauth = require('./oauth');
var password = require('./password');
var util = require('../util/util');
var dbUtils = require('../database/db-utils');
var Q = require("q");


var bcrypt = require('bcrypt'),
    SALT_WORK_FACTOR = 10;


/**
 * Sets up session handling for the app.
 * @param {Object} app             An express app.
 */
exports.addSessionHandling = function (app) {
  var connection = dbUtils.getConnectionNow();

  var sessionStore = new MongoStore({
    db: connection.db
  });

  app.use(express.cookieParser()); //appConfig.authentication.cookieSecret));
  app.use(express.session({
    secret: '076ad5894a80f20e70b1e3ab0e4686b5',
    maxAge: 3600000, // 1 hour
    store: sessionStore
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (obj, done) {
    done(null, obj);
  });
};

/**
 * Adds routes for authentication and related things.
 * @param {Object} app             An express app.
 */
exports.addAuthenticationRoutes = function (app) {
  var authConfig = config.getConfig('authentication');
  var oauthConfig = config.getConfig('oauth');
  var connection = dbUtils.getConnectionNow();
  var providerAccounts = connection.model('userProviderAccounts');
  var users = connection.model('users');

  // GET /auth/user - returns info about the logged in user, in an envelope.
  app.get('/auth/user', function (req, res) {
    res.send(200, req.user);
  });

  // PUT /auth/user - update the current user's record. This is meant to be
  // used for the purpose of registration, etc. For now we only allow this
  // method to set username. This is currently working only for OAuth users.
  app.put('/auth/user', function (req, res) {
    var query;
    var update;

    // Check if the user is actually logged in. We should try to update info
    // for an anonymous user.
    if (!(req.user && req.user.data)) {
      log.error('no user or no user data');
      res.send(500, 'Internal error');
      return;
    }

    // For right now, we do not allow the user to change their username if it
    // has been set before.
    if (req.user.username) {
      res.send(401, 'You cannot change the user name of a registered user.');
      return;
    }

    // Setup and execute an update query.
    query = {
      provider: req.user.data.provider,
      idWithProvider: req.user.data.idWithProvider
    };
    update = {
      username: req.body.username
    };
    providerAccounts.update(query, update).exec()
      .then(function () {
        // Now we need to update user's data in the session. The simplest way
        // to do that is to first get the current user's data.
        return oauth.getUserFromProfile(providerAccounts, req.user.data)
          .then(function (userRecord) {
            if (!userRecord) {
              throw new Error('Could not get user record.');
            }
            // Once we have the userRecord, we try to update the session.
            req.login(userRecord, function (error) {
              if (error) {
                throw error;
              } else {
                res.send(200, 'Ok');
              }
            });
          });
      })
      .then(null, util.makeErrorResponder(res));
  });

  // POST /auth/user - Add (register) a new user
  app.post('/auth/user', function (req, res) {

    if (!req.body.username || !req.body.password || !req.body.displayName || !req.body.email) {
      res.send(401, 'You must provide username, email, and password');
      return;
    }


    // Encrypt the password
    bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
      if (err) {
        log.error('Could not generate salt.')
        return res.send(500, 'Internal error');
      }

      // hash the password using our new salt
      bcrypt.hash(req.body.password, salt, function (err, hash) {
        if (err) {
          log.error('Could not hash password');
          return res.send(500, 'Internal error');
        }

        var user = new users();

        user.displayName = req.body.displayName;
        user.password = hash;
        user.username = req.body.username;
        user.email = req.body.email;

        user.save(function (err, user) {
          // code 11000 is a mongoose code duplicate key error
          if (err && err.code === 11000) {
            log.error('Could not save user, is username and email unique? ' + err.message);
            return res.send(422, 'Username already exists.');
          } else if (err){
            log.error(err.message);
            return res.send(500, 'Internal error');
          }
          if (user) {
            log.info(user.username + ' was saved to the database');
            res.send(200, user);
          }
        });

      });
    });
  });

  // POST /auth/logout - logs out the user.
  app.post('/auth/logout', function (req, res) {
    req.logout();
    res.send(200, 'Ok');
  });

  // GET /auth/usernameAvailable - checks if a username is available.
  app.get('/auth/usernameAvailable', function (req, res) {
    if (!req.query.username) {
      res.send(400, 'Please provide a username');
    }
    var query = {
      username: req.query.username
    };

    var userCollection = authConfig.strategy === 'password' ? users : providerAccounts;
    userCollection.find(query).exec()
      .then(function (matchingUsers) {
        res.send(200, matchingUsers.length === 0);
      })
      .then(null, util.makeErrorResponder(res));
  });

  // For now configure this regardless of authentication config, for backwards
  // compatibility.
  if (oauthConfig) {
    log.info('Adding OAuth routes');
    // Finally, use oauth.init to setup routes for all configured providers.
    _.keys(oauthConfig).forEach(function (provider) {
      oauth.init(app, provider, oauthConfig[provider], providerAccounts);
    });
  }

  // Configure password authentication if necessary.
  console.log('Authentication strategy:', authConfig.strategy);
  if (authConfig.strategy === 'password') {
    password.setup(app, users, {});
  }
};

/**
 * Give a user object and password, save the user to the database
 * with an encryped password.
 *
 * If the saving the user was successful, return a successful promise, otherwise rejected promise.
 *
 * @param {Object} user
 * @param {String} password
 * @param {Object} res response
 */
exports.saveUser = function(user, password) {
  var deferred = Q.defer();

  // Encrypt the password
  SALT_WORK_FACTOR = 10;
  bcrypt.genSalt(SALT_WORK_FACTOR, function(err, salt) {
    if (err) {
      log.error('Could not generate salt.');
      return deferred.reject(err);
    }

    // hash the password using our new salt
    bcrypt.hash(password, salt, function(err, hash) {
      if (err) {
        log.error('Could not hash password');
        return deferred.reject(err);
      }

      user.password = hash;

      user.save(function(err, user) {
        if (err) {}

        if (user) {
          log.info(user.username + ' was saved to the database');
          deferred.resolve(user);
        } else {
          return deferred.reject(err);
        }
      });

    });
  });

  return deferred.promise;
};