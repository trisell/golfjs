var async = require('async');
var express = require('express');
var bodyParser = require('body-parser');
var r = require('rethinkdb');

var config = require(__dirname + '/config.js');

var app = express();


//For serving the index.html and all the other front-end assets.
app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());

//The REST routes for "todos".
app.route('/golf')
  .post(createTeam)
  .get(listTeams);

app.route('/golf/:id')
  .get(getTeamData)
  .put(updateTeamData);
//  .delete(deleteTeamData);

//app.route('/teams/:team/:score')

//If we reach this middleware the route could not be handled and must be unknown.
app.use(handle404);

//Generic error handling middleware.
app.use(handleError);


/*
 * Retrieve all teams.
 */
function listTeams(req, res, next) {
  r.table('golfData').orderBy({index:'team'}).run(req.app._rdbConn, function(err, cursor) {
    if(err) {
      return next(err);
    }

    //Retrieve all the teams in an array.
    cursor.toArray(function(err, result) {
      if(err) {
        return next(err);
      }

      res.json(result);
    });
  });
}

/*
 * Insert a new todo item.
 */
function createTeam(req, res, next) {
  var teamData = req.body;
//  teamData.createdat = r.now();

  console.dir(teamData);

  r.table('golfData').insert(teamData, {returnChanges: true}).run(req.app._rdbConn, function(err, result) {
    if(err) {
      return next(err);
    }

    res.json(result.changes[0].new_val);
  });
}

/*g
 * Get a specific todo item.
 */
function getTeamData(req, res, next) {
  var teamDataId = req.params.team;

  r.table('golfData').get(teamDataId).run(req.app._rdbConn, function(err, result) {
    if(err) {
      return next(err);
    }

    res.json(result);
  }));
}

/*
 * Update a todo item.
 */
function updateTeamData(req, res, next) {
  var teamData = req.body;
  var teamDataID = req.params.name;

  r.table('golfData').get(teamDataID).update(teamData, {returnChanges: true}).run(req.app._rdbConn, function(err, result) {
    if(err) {
      return next(err);
    }

    res.json(result.changes[0].new_val);
  });
}

/*
 * Delete a todo item.
 * Do I need to delete anything?
 */
/*
function deleteTeamData(req, res, next) {
  var teamDataID = req.params.id;

  r.table('golfData').get(teamDataID).delete().run(req.app._rdbConn, function(err, result) {
    if(err) {
      return next(err);
    }

    res.json({success: true});
  });
}
*/
/*
 * Page-not-found middleware.
 */
function handle404(req, res, next) {
  res.status(404).end('not found');
}

/*
 * Generic error handling middleware.
 * Send back a 500 page and log the error to the console.
 */
function handleError(err, req, res, next) {
  console.error(err.stack);
  res.status(500).json({err: err.message});
}

/*
 * Store the db connection and start listening on a port.
 */

function startExpress(connection) {
  app._rdbConn = connection;
  app.listen(config.express.port);
  console.log('Listening on port ' + config.express.port);
}

/*
 * Connect to rethinkdb, create the needed tables/indexes and then start express.
 * Create tables/indexes then start express
 */
async.waterfall([
  function connect(callback) {
    r.connect(config.rethinkdb, callback);
  },
  function createDatabase(connection, callback) {
    //Create the database if needed.
    r.dbList().contains(config.rethinkdb.db).do(function(containsDb) {
      return r.branch(
        containsDb,
        {created: 0},
        r.dbCreate(config.rethinkdb.db)
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function createTable(connection, callback) {
    //Create the table if needed.
    r.tableList().contains('golfData').do(function(containsTable) {
      return r.branch(
        containsTable,
        {created: 0},
        r.tableCreate('golfData')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function createIndex(connection, callback) {
    //Create the index if needed.
    r.table('golfData').indexList().contains('team').do(function(hasIndex) {
      return r.branch(
        hasIndex,
        {created: 0},
        r.table('golfData').indexCreate('team')
      );
    }).run(connection, function(err) {
      callback(err, connection);
    });
  },
  function waitForIndex(connection, callback) {
    //Wait for the index to be ready.
    r.table('golfData').indexWait('team').run(connection, function(err, result) {
      callback(err, connection);
    });
  }
], function(err, connection) {
  if(err) {
    console.error(err);
    process.exit(1);
    return;
  }

  startExpress(connection);
});
