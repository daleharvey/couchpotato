## Couch Potato

Couch Potato is a data adapter for CouchDB, a generic server that lets you easily read from various data sources and put that data into CouchDB.

## Usage

Start a couchpotato process with the url to a database, couchpotato will create this database if it doesnt exist, then listen to the database for scheduled jobs.

    $ node couchpotato.js http://127.0.0.1:5984/couchpotato

Once the process is started, to schedule a job you write a document to the database, each job takes a custom job description which you can find documented below, this example will read the google.com homepage every out and save the results to your local database `myscreenscapes`

   { "worker": "webpage"
   , "ttl": 60 * 60 * 100
   , "opts": {"uri":http://google.com"}
   , "destination": "myscreenscrapes"
   }

There are a few common global attributes you can add to jobs, they are all optional

* `ttl` - (defaults to 30 minutes) This is the time in milliseconds between subsequen runs of the job
* `destination` - This is the database that the results get written to, you can specify a full url (including auth details), if you only specify a string it will get saved to the same host that the `couchpotato` database is.
* `opaque` - This will passed through and written in the same

## Screenscrape a webpage

   { "worker": "webpage"
   , "ttl": 60 * 60 * 100
   , "opts": {"uri":http://google.com"}
   , "destination": "myscreenscrapes"
   }


This is currently the only worker written.

TODO:
 * RSS reader
 * Twitter API reader (problem with oauth?)
 * Github Issues
 * POP / Email Reader
 * Foursquare / Gowalla etc

