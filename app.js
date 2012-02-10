/**
 * Module dependencies.
 */

var express = require('express'),
    cradle  = require('cradle');

// Express
var app = module.exports = express.createServer();
// Configuration

// for couch
var cradle = require('cradle');
var host = 'https://goodmike.cloudant.com';
var port = 5984;
var credentials = {username: 'xxx', password: 'yyy' };
var local=true;
var db;
if(local===true) {
  db = new(cradle.Connection)().database('html5-microblog');
}
else {
  db = new(cradle.Connection)(host, port, {auth: credentials}).database('html5-microblog');
}

// global data, helpers
var contentType = 'text/html';
var baseUrl = 'http://localhost:3000/microblog/';
var viewPath = '_design/basic/_view/';
var qquote = String.fromCharCode(34);

var today = function() {
  var d = new Date();
  var curr_date = d.getDate();
  var curr_month = d.getMonth() + 1; //months are zero based
  var curr_year = d.getFullYear();
  return curr_date + "-" + curr_month + "-" + curr_year;
}

// Configuration
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});


/* validate user (from db) via HTTP Basic Auth */
function validateUser(req, res, next) {

  var parts, auth, scheme, credentials;
  var view, options;
  
  // handle auth stuff
  auth = req.headers["authorization"];
  if (!auth){
    return authRequired(res, 'Microblog');
  }
  
  parts = auth.split(' ');
  scheme = parts[0];
  credentials = new Buffer(parts[1], 'base64').toString().split(':');
  console.log("\n ** scheme and credentials found? " + scheme + " " + credentials[0] + " " + credentials[1]);
  if ('Basic' != scheme) {
    return badRequest(res);
  }
  req.credentials = credentials;

  // ok, let's look this user up
  view = '_design/basic/_view/users_by_id';
  
  options = {};
  options.descending=true;
  options.key=qquote+req.credentials[0]+qquote;
  
  db.get(view, options, function(err, doc) {
      for (key in err) {
          console.log("err[" + key + "]: " + err[key]);
       }
    try {
      if(doc[0].value.password===req.credentials[1]) {
        next(req,res);
      }
      else {
        throw new Error('Invalid User');
      }
    }
    catch (ex) {
      return authRequired(res, 'Microblog');
    }
  });
}



// Routes

/* Static client files */
app.use("/client", express.static(__dirname + '/client'));

/* GET user register page */
app.get('/microblog/register', function(req,res) {
    
    res.header('content-type',acceptsXml(req));
    res.render('register', {
        title: "Register",
        site:  baseUrl
    });
});


/* POST to user list page */
app.post('/microblog/users', function(req,res) {
   var item, id;
   
   id = req.body.user;
   if (id==='') {
       res.status=400;
       res.send('missing user');
       return; // just for clarity
   } else {
       item = {
           type: 'user',
           password: req.body.password,
           name: req.body.name,
           email: req.body.email,
           description: req.body.description,
           imageUrl: req.body.avatar,
           websiteUrl: req.body.website,
           dateCreated: today()
       };
       
       // write to DB
       db.save(id, item, function(err, doc) {
           if(err) {
               res.status=400;
               res.send(err);
               return; // just for clarity
           } else {
               res.redirect('/microblog/users', 302);
           }
       });
   }
});


/* GET user list page */
app.get('/microblog/users', function(req,res) {

    
    db.get('_design/basic/_view/users_by_id', function(err,doc) {
       for (var key in err) {
           console.log("err[" + key + "]: " + err[key]);
       }
       res.header('content-type',acceptsXml(req));
       res.render('users', {
          title: 'User List',
          site: baseUrl,
          items: doc
       });
   });
});


/* GET user profile page */
app.get('/microblog/users/:i', function(req,res) {
    
    var options, id;
    
    id = req.params.i;
    options = {
        descending: true,
        key: qquote + id + qquote
    };
    
    db.get(viewPath + 'users_by_id', options, function(err,doc) {
       for (key in err) {
           console.log("err[" + key + "]: " + err[key]);
       };
       res.header('content-type',acceptsXml(req));
       res.render('user', {
          title: id,
          site: baseUrl,
          items: doc
       });
   });
});


/* POST add a message */
app.post('/microblog/messages/', function(req, res) {
  
  validateUser(req, res, function(req,res) {
  
    var text;
    
    // get data array
    text = req.body.message;
    if(text!=='') {
        var item = {};
        item.type='post';
        item.text = text;
        item.user = req.credentials[0];
      
        item.dateCreated = now();
      
        // write to DB
        db.save(item, function(err, doc) {
            if(err) {
                res.status=400;
                res.send(err);
            }
            else {
                res.redirect('/microblog/', 302);
            }
        });  
    }
    else {
      return badReqest(res);
    }
  });
});


/* GET user messages page */
app.get('/microblog/user-messages/:i', function(req,res) {
    var options, id;
    
    id = req.params.i;
    options = {
        descending: true,
        key: qquote + id + qquote
    };
    db.get(viewPath + 'posts_by_user', options, function(err,doc) {
       for (key in err) {
           console.log("err[" + key + "]: " + err[key]);
       }
       res.header('content-type',acceptsXml(req));
       res.render('user-messages', {
          title: id,
          site: baseUrl,
          items: doc
       });
   });
});


/* GET single message page */
app.get('/microblog/messages/:i', function(req,res) {
    var options, id;
    
    id = req.params.i;
    options = {
        descending: true,
        key: qquote + id + qquote
    };
    
    db.get(viewPath + 'posts_by_id', options, function(err,doc) {
       for (key in err) {
           console.log("err[" + key + "]: " + err[key]);
       };
       res.header('content-type',acceptsXml(req));
       res.render('message', {
          title: id,
          site: baseUrl,
          items: doc
       });
   });
});

/* GET Starting Page */
app.get('/microblog', function(req,res) {
    
    var options = { descending: true };
    ctype = acceptsXml(req);
    
    db.get(viewPath + 'posts_all', options, function(err,doc) {
       res.header('content-type',ctype);
       res.render('index', {
           title: 'Home',
           site: baseUrl,
           items: doc
       });
    });
});


// UTILITIES

/* support various content-types from clients */
function acceptsXml(req) {
  var ctype = contentType;
  var acc = req.headers["accept"];
  
  switch(acc) {
    case "text/xml":
      ctype = "text/xml";
      break;
    case "application/xml":
      ctype = "application/xml";
      break;
    case "application/xhtml+xml":
      ctype = "application/xhtml+xml";
      break;
    default:
      ctype = contentType;
      break;
  }
  return ctype;
}


/* compute the current date/time */
function now() {
  var y, m, d, h, i, s, dt;
  
  dt = new Date();
  
  y = String(dt.getFullYear());
  
  m = String(dt.getMonth()+1);
  if(m.length===1) {
    m = '0'+m;
  }

  d = String(dt.getDate());
  if(d.length===1) {
    d = '0'+d.toString();
  }
  
  h = String(dt.getHours()+1);
  if(h.length===1) {
    h = '0'+h;
  }
  
  i = String(dt.getMinutes()+1);
  if(i.length===1) {
    i = '0'+i;
  }
  
  s = String(dt.getSeconds()+1);
  if(s.length===1) {
    s = '0'+s;
  }
  return y+'-'+m+'-'+d+' '+h+':'+i+':'+s;
}

/* return standard 403 response */
function forbidden(res) {

  var body = 'Forbidden';

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Length', body.length);
  res.statusCode = 403;
  res.end(body);
}

/* return standard 'auth required' response */
function authRequired(res,realm) {
  var r = (realm||'Authentication Required');
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="' + r + '"');
  res.end('Unauthorized');
}

/* return standard 'bad inputs' response */
function badRequest(res) {
  res.statusCode = 400;
  res.end('Bad Request');
}

app.listen(3000);