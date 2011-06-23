

var follow = require('follow')
  , request = require('request')
  , cron = require("cron")
  , plainUri = process.argv[2]
  , uri = require("url").parse(plainUri);


var jobMap = function(doc) {
  if (!doc.lastSeen) {
    emit(0, null);
  } else {
    var ttl = (typeof doc.ttl === "undefined") ? 5*60*1000 : doc.ttl;
    emit(doc.lastSeen + ttl);
  }
}


var designDoc =
    { views:
      { jobs:
        { map: jobMap.toString() }
      }
    };


function runJobs() {

  console.log("Fetching new jobs: ");

  request(
    { method: 'GET'
    , uri: plainUri + "/_design/couchpotato/_view/jobs?include_docs=true&endkey=" + new Date().getTime()
    }, function(err, resp, body) {
      body = JSON.parse(body);
      for (var i = 0; i < body.rows.length; i++) {
        var job = body.rows[i].doc;
        if (job.worker) {
          console.log("Processing job: " + job.worker + " from " + job._id);
          require("./workers/cp-" + job.worker).process({uri:uri}, job);
        }

        markSeen(job)
      }
    }
  );
}


function markSeen(doc) {

  doc.lastSeen = new Date().getTime();

  request(
    { method: 'PUT'
    , uri: plainUri + "/" + doc._id
    , body: JSON.stringify(doc)
    }, function(err, resp, body) {
      if (resp.statusCode === 201) {
        console.log("Marked " + doc._id + " as seen");
      }
    }
  );

}


request(
  { method: 'GET'
  , uri: plainUri + "/_design/couchpotato"
  },  function(err, resp, body) {

    if (resp.statusCode === 200) {
      designDoc._rev = JSON.parse(body)._rev;
    }

    if (resp.statusCode === 200 || resp.statusCode === 404) {
      request(
        { method: 'PUT'
        , uri: plainUri + "/_design/couchpotato"
        , body: JSON.stringify(designDoc)
        }, function(err, resp, body) {
          if (resp.statusCode === 201) {
            new cron.CronJob('1 * * * * *', runJobs);
            runJobs();
          }
        }
      );
    }
  }
);


