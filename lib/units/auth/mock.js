var http = require('http')

var express = require('express')
var validator = require('express-validator')
var cookieSession = require('cookie-session')
var bodyParser = require('body-parser')
var serveStatic = require('serve-static')
var csrf = require('csurf')
var Promise = require('bluebird')
var basicAuth = require('basic-auth')

var logger = require('../../util/logger')
var requtil = require('../../util/requtil')
var jwtutil = require('../../util/jwtutil')
var pathutil = require('../../util/pathutil')
var urlutil = require('../../util/urlutil')
var lifecycle = require('../../util/lifecycle')

module.exports = function(options) {
  var log = logger.createLogger('auth-mock')
  var app = express()
  var server = Promise.promisifyAll(http.createServer(app))

  lifecycle.observe(function() {
    log.info('Waiting for client connections to end')
    return server.closeAsync()
      .catch(function() {
        // Okay
      })
  })

  // BasicAuth Middleware
  var basicAuthMiddleware = function(req, res, next) {
    function unauthorized(res) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required')
      return res.send(401)
    }

    var user = basicAuth(req)

    if (!user || !user.name || !user.pass) {
      return unauthorized(res)
    }

    if (user.name === options.mock.basicAuth.username &&
        user.pass === options.mock.basicAuth.password) {
      return next()
    }
    else {
      return unauthorized(res)
    }
  }

  app.set('view engine', 'pug')
  app.set('views', pathutil.resource('auth/mock/views'))
  app.set('strict routing', true)
  app.set('case sensitive routing', true)

  app.use(cookieSession({
    name: options.ssid
  , keys: [options.secret]
  }))
  app.use(bodyParser.json())
  app.use(csrf())
  app.use(validator())
  app.use('/static/bower_components',
    serveStatic(pathutil.resource('bower_components')))
  app.use('/static/auth/mock', serveStatic(pathutil.resource('auth/mock')))

  app.use(function(req, res, next) {
    res.cookie('XSRF-TOKEN', req.csrfToken())
    next()
  })

  if (options.mock.useBasicAuth) {
    app.use(basicAuthMiddleware)
  }

  app.get('/', function(req, res) {
    res.redirect('/auth/mock/')
  })

  /**
   * hijack this method to create auto authenticate with the session
   * !previous code commented!
   * USAGE 
   * /auth/mock/?id=<value>
   * TO-DO
   * the value passed shuld be the encoded data
   */
  app.get('/auth/mock/', function(req, res) {
    //res.render('index') // no need to send this now

    //just the working prototype need to handle the exception
    id_ = req.query.id;

    if(id_ == undefined)
    {
      console.log("/auth/mock/ id not found ")
    }

     //generate token with hard value
     //@TODO : need more changes
     var token = jwtutil.encode({
      payload: {
        email:  "some@email.com" ,
        name: "yoo" 
      }
    , secret: options.secret
    , header: {
        exp: Date.now() + 24 * 3600
      }
    })

    res.redirect(urlutil.addParams(options.appUrl, {
      jwt: token
    }));

    console.log("headers "+JSON.stringify(req.headers)+" urls "+options.appUrl +" orginalurl "+req.originalUrl);
    console.log("redirected /auth/mock/"); //debug


  })


  /**
   * custom function to launch the device
   * http://192.168.0.115:7100/auth/cus/?id=sapan&serial=FY4SJBTGUSMJ7LGE
   * 
   * TODO :-
   * need to set the redirect
   *      */
  app.get('/auth/cus/', function(req, res) {
    //res.render('index') // no need to send this now

    //just the working prototype need to handle the exception
    id_ = req.query.id;
    serial_ = req.query.serial;
    time_ = req.query.time;
    if(id_ == undefined)
    {
      id_ = tmp;
    }

    if(serial_ == undefined)
    {
      console.log("serial_ undefined ");
      var token = jwtutil.encode({
        payload: {
          email:  "some@email.com" ,
          name: "yoo" 
        }
      , secret: options.secret
      , header: {
          exp: Date.now() + 24 * 3600
        }
      });

      res.redirect(urlutil.addParams(options.appUrl, {
        jwt: token
      }));


    }



     //generate token with hard value
     //@TODO : need more changes
     var token = jwtutil.encode({
      payload: {
        email:  "some@email.com" ,
        name: id_ 
      }
    , secret: options.secret
    , header: {
        exp: Date.now() + 24 * 3600
      }
    })

    res.redirect(urlutil.addParams(options.appUrl+'/#!/control/'+serial_, {
      jwt: token,
      time:time_
    }));

    //console.log("headers "+JSON.stringify(req.headers)+" urls device "+options.appUrl +" orginalurl "+req.originalUrl);
    console.log("redirected options.appUrl+'/#!/control/'+serial_"); //debug


  });


  app.post('/auth/api/v1/mock', function(req, res) {
    var log = logger.createLogger('auth-mock')
    log.setLocalIdentifier(req.ip)
    switch (req.accepts(['json'])) {
      case 'json':
        requtil.validate(req, function() {
            req.checkBody('name').notEmpty()
            req.checkBody('email').isEmail()
          })
          .then(function() {
            log.info('Authenticated "%s"', req.body.email)
            var token = jwtutil.encode({
              payload: {
                email: req.body.email
              , name: req.body.name
              }
            , secret: options.secret
            , header: {
                exp: Date.now() + 24 * 3600
              }
            })
            res.status(200)
              .json({
                success: true
              , redirect: urlutil.addParams(options.appUrl, {
                  jwt: token
                })
              })
          })
          .catch(requtil.ValidationError, function(err) {
            res.status(400)
              .json({
                success: false
              , error: 'ValidationError'
              , validationErrors: err.errors
              })
          })
          .catch(function(err) {
            log.error('Unexpected error', err.stack)
            res.status(500)
              .json({
                success: false
              , error: 'ServerError'
              })
          })
        break
      default:
        res.send(406)
        break
    }
  })

  server.listen(options.port)
  log.info('Listening on port %d', options.port)
}
