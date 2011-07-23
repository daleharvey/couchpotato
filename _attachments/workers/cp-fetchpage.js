
var request = require('request');

function process(ctx, doc) {

  if (doc.opts && doc.destination) {

    request(doc.opts, function(err, resp, body) {

      var result =
        { time: (new Date().getTime())
        , uri: doc.opts.uri
        , statusCode: resp.statusCode
        , headers:resp.headers
        , body: body
        };

      if (doc.opaque) {
        result.opaque = doc.opaque;
      }

      var destination = require("url").parse(doc.destination);
      var uri = (!destination.protocol)  ?
        ctx.uri.protocol + "//" + ctx.uri.host + "/" + doc.destination :
        doc.destination;

      request(
        { method: 'PUT'
        , uri: uri
        }, function(err, resp, body) {
          if (resp.statusCode === 201 || resp.statusCode === 412) {
            request(
              { method: 'POST'
              , headers: {'content-type':"application/json"}
              , uri: uri
              , body: JSON.stringify(result)
              }, function(err, resp, body) {
                if (resp.statusCode === 201) {
                  console.log("Saved webpage " + doc.opts.uri + " to " + uri);
                }
              }
            );
          }
        }
      );
    });

  }

}

exports.process = process;