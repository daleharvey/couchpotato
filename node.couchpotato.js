

var http = require('http')
var follow = require('follow')
var request = require('request')
var cron = require("cron");

var opts = {
  host: "127.0.0.1",
  ping_port: 9876,
  couch_port: 5984,
  db_name: "couchpotato",
  ddoc: "_design/jobs"
};


function ddocUrl() {
  return "http://" + opts.host + ":" + opts.couch_port + "/"
         + opts.db_name + "/" + opts.ddoc;
}

function init() {

  startPingHost();

  request({method: 'GET', uri:ddocUrl()}, function(err, resp, body) {

    if (resp.statusCode !== 200) {
      throw({error: "Error fetching design doc"});
    }

    var json = JSON.parse(body);
    var ping_host = "http://" + opts.host + ":" + opts.ping_port + "/";

    if (json.ping_host !== ping_host) {

      json.ping_host = ping_host;
      request({ method: 'PUT',
                uri: ddocUrl(),
                body: JSON.stringify(json)}, function(err, resp, body) {
        if (resp.statusCode === 201) {
          startJobs(json);
        }
      });
    } else {
      startJobs(json);
    }
  });
}


function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": false,
    "Access-Control-Max-Age": '86400',
    "Access-Control-Allow-Headers":
      "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept" };
};

function startPingHost() {
  http.createServer(function (req, res) {
    var headers = corsHeaders();
    headers["Content-Type"] = 'text/plain';
    res.writeHead(200, headers);
    res.end('pong\n');
  }).listen(opts.ping_port, opts.host);
  console.log('Ping server running at http://' + opts.host + ':' + opts.ping_port);
};


function isDesignDoc(id) {
  return id.match(opts.ddoc) !== null;
}

function restartJob(job, newDoc) {
  console.log("Restarting job: " + job.id);
  stopJob(job);
  return startJob(newDoc);
}

function stopJob(job) {
  console.log("Starting job: " + job.id);
  return clearInterval(job.timer);
}

function findByID(jobs, id) {
  for (var i in jobs) {
    console.log("job", i, jobs[i]);
    if (jobs[i] && jobs[i]._id === id) {
      return jobs[i];
    }
  }
  return false;
}

function restartChangedJobs(jobs, jobDefs) {

  for (var i in jobs) {

    if (!jobs[i]) {
      break;
    }

    if (typeof jobDefinitions[jobs[i].doc.jobType] === "undefined") {
      stopJob(jobs[i]);
      delete jobs[i];
    } else if (jobDefinitions[jobs[i].doc.jobType].code !== jobs[i].code) {
      jobs[i] = restartJob(jobs[i]);
    }
  }

  return jobs;
}

function startJobs(json) {

  var jobDefinitions = json.jobs
    , jobs = {}
    , url = "http://" + opts.host + ":" + opts.couch_port + "/" + opts.db_name + "/";

  follow({db:url, include_docs:true, since:"now"}, function(error, change) {

    if (error) {
      throw(error);
    }

    console.log(change);

    if (isDesignDoc(change.id)) {
      jobDefinitions = change.doc.jobs || {};
      jobs = restartChangedJobs();
    } else {
      console.log(jobs);
      var job = findByID(jobs, change.id);
      console.log("hello", change.id, change.deleted, job);
      if (change.deleted && job) {
        console.log("wtf deleting");
        stopJob(job);
        delete jobs[change.id];
      } else if (job) {
        jobs[change.id] = restartJob(change.doc);
      } else {
        jobs[change.id] = startJob(change.doc);
      }
      console.log(change);
    }
  });

  tmp(jobDefinitions, function(data) {
    jobs = data;
  })

}

    // if (!/_design\/jobs/.test(change.id)) {
    //   jobDefinitions = change.doc.jobs;
    //   for (var i in jobs) {

    //     if (!jobs[i]) {
    //       break;
    //     }

    //     if (typeof jobDefinitions[jobs[i].doc.jobType] === "undefined") {
    //       deleteJob(change.doc);
    //       delete jobs[i];
    //     } else if (jobDefinitions[jobs[i].doc.jobType].code !== jobs[i].code) {
    //       clearInterval(change.job.timer);
    //       jobs[i] = startJob(change.doc, jobDefinitions);
    //     }
    //   }
    // } else {
    //   for (var i in jobs) {
    //     if (jobs[i].doc._id === change.id) {
    //       console.log("Job " + change.id + " changed, restarting:");
    //       clearInterval(change.job.timer);
    //       jobs[i] = startJob(change.doc, jobDefinitions);
    //     }
    //   }
    // }
  // });


function startJob(doc, jobDefs) {

  console.log("Initialising job "+ doc._id + ": " + doc.source + " => " + doc.target);

  if (!doc.jobType || !jobDefs[doc.jobType].code) {
    console.log("Job does not have a valid jobType");
    return false;
  }

  var job = cron.CronJob(doc.ttl, function() {
    console.log("yay Running job: " + doc.source + " => " + doc.target);
  });

  return {"cron": job, "doc": doc, "code": jobDefs[doc.jobType].code};
}

function tmp(jobDefinitions, callback) {

  var doc, jobs = {}
    , url = "http://" + opts.host + ":" + opts.couch_port + "/" + opts.db_name + "/"
          + '_all_docs?include_docs=true';

  request({method: 'GET', uri: url}, function(err, resp, body) {
    body = JSON.parse(body);
    for (var i in body.rows) {
      doc = body.rows[i].doc;
      if (!/_design/.test(doc._id)) {
        jobs[doc._id] = startJob(doc, jobDefinitions);
      }
    }
    callback(jobs);
  });
};

init();


// var jobMap = function(doc) {
//   if (!doc.lastSeen) {
//     emit(0, null);
//   } else {
//     var ttl = (typeof doc.ttl === "undefined") ? 5*60*1000 : doc.ttl;
//     emit(doc.lastSeen + ttl);
//   }
// }


// var designDoc =
//     { views:
//       { jobs:
//         { map: jobMap.toString() }
//       }
//     };


// function runJobs() {

//   console.log("Fetching new jobs: ");

//   request(
//     { method: 'GET'
//     , uri: plainUri + "/_design/couchpotato/_view/jobs?include_docs=true&endkey=" + new Date().getTime()
//     }, function(err, resp, body) {
//       body = JSON.parse(body);
//       for (var i = 0; i < body.rows.length; i++) {
//         var job = body.rows[i].doc;
//         if (job.worker) {
//           console.log("Processing job: " + job.worker + " from " + job._id);
//           require("./workers/cp-" + job.worker).process({uri:uri}, job);
//         }

//         markSeen(job)
//       }
//     }
//   );
// }


// function markSeen(doc) {

//   doc.lastSeen = new Date().getTime();

//   request(
//     { method: 'PUT'
//     , uri: plainUri + "/" + doc._id
//     , body: JSON.stringify(doc)
//     }, function(err, resp, body) {
//       if (resp.statusCode === 201) {
//         console.log("Marked " + doc._id + " as seen");
//       }
//     }
//   );

// }


