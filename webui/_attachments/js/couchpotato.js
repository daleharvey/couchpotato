// http://paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function(){
  log.history = log.history || [];
  log.history.push(arguments);
  if(this.console){
    console.log( Array.prototype.slice.call(arguments) );
  }
};


var CouchPotato = (function() {

  Handlebars.registerHelper('toDate', function(text, url) {
    var date = new Date(text);
    return isValidDate(date) ? date.toString('hh:mm:ss dddd, MMMM d, yyyy') : "N/A";
  });

  var $db = $.couch.db("couchpotato")
    , router = Router()
    , $content = $("#content")
    , designDoc = {}
    , pingHost = null
    , statusTimer = null;


  router.get(/^(#)?$/, function (rtr) {
    $db.allDocs({include_docs:true}).then(function(data) {

      var jobs = []
        , docs = splitDesignDocs(data.rows);

      var ddocs = designDoc = $.grep(docs.designDocs, function(doc) {
        return /^_design\/jobs/.test(doc._id);
      });

      designDoc = (ddocs.length) === 0 ? {} : ddocs[0];
      designDoc.jobs = designDoc.jobs || {};
      designDoc._id = "_design/jobs";

      pingHost = designDoc.ping_host || null;
      startNodeStatus(pingHost);

      for(var prop in designDoc.jobs) {
        if (designDoc.jobs.hasOwnProperty(prop)) {
          jobs.push({ "_id": designDoc._id
                    , "_rev": designDoc._rev
                    , "name": prop
                    , "description": designDoc.jobs[prop].description
                    , "code": designDoc.jobs[prop].code});
        }
      }

      render($content, "#tasks_tpl", {"plainDocs":docs.plainDocs, "jobDefinitions":jobs});

      $("#show_add_row_btn").bind('click', function() {
        $("#add_row").toggle();
      });
      $("#create_job_btn").bind('click', function() {
        $("#create_job").toggle();
      });
      $(".job_name").bind('click', function() {
        $(this).parents("tr").next().toggle();
      });

    });
  });


  router.post('#add_row', function(_, e, data) {
    var obj = { source: data.source
              , type: data.type
              , target: data.target
              , ttl: data.ttl
              , status: "active" };
    $db.saveDoc(obj).then(router.refresh);
  });

  router.post('#delete_job', function(_, e, data) {
    $db.removeDoc({_id: data.id, _rev:data.rev}).then(router.refresh);
  });

  router.post('#set_job', function(_, e, data) {
    designDoc.jobs[data.name] = { "description":data.description
                                , "code": data.code };
    $db.saveDoc(designDoc).then(router.refresh);
  });


  function isValidDate(d) {
    if (Object.prototype.toString.call(d) !== "[object Date]") {
      return false;
    }
    return !isNaN(d.getTime());
  }

  function splitDesignDocs(array) {
    var plainDocs = []
      , designDocs = [];
    $.each(array, function(_, doc) {
      if (/^_design/.test(doc.id)) {
        designDocs.push(doc.doc);
      } else {
        plainDocs.push(doc.doc);
      }
    });
    return { designDocs: designDocs
           , plainDocs: plainDocs };
  }

  function filterDesignDocs(array) {
    return $.grep(array, function(el) {
      return !/^_design/.test(el.id);
    });
  }

  function render($dom, id, data) {
    var html = Handlebars.compile($(id).html())(data);
    $dom.html(html);
  }

  function nodeStatus() {
    $.get(pingHost).done(function() {
      $("#status").text("yay node up, last checked " + new Date().toString());
    }).fail(function() {
      $("#status").text("ah crap");
    });
  }

  function startNodeStatus(host) {
    if (!host) {
      $("#status").text("node not initialised");
    } else {
      statusTimer = setInterval(nodeStatus, 3000);
      nodeStatus();
    }
  }

  router.init(window);

})();