/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// A script to report on the percentage progress of items
// under a bugzilla metabug, for a given time period.
// We'll use it to assess OKRs of the form "reduce backlog
// under bug X by Y%".
//
// Usage:
//
//    node ./scripts/report_metabug_progress bugNumber [startDate endDate]
//


var P = require('bluebird')
var request = P.promisify(require('request'), { multiArgs: true })

var BZ_URL = 'https://bugzilla.mozilla.org/rest'
var BZ_STATUS_OPEN = [
  'UNCONFIRMED',
  'NEW',
  'ASSIGNED',
  'REOPENED'
]


function requestJSON(url) {
  return request(url).spread(function (res, body) {
    if (res.statusCode !== 200) {
      var err = new Error("HTTP Request failed with status code " + res.statusCode)
      err.response = res
      throw err
    }
    return JSON.parse(body)
  })
}


module.exports = {

  queryBugs: function queryBugs(args) {
    var url = BZ_URL + '/bug?'
    Object.keys(args).forEach(function(key) {
      url += '&' + key + '=' + args[key]
    })
    if (process.env.BZ_API_KEY) {
      url += '&api_key=' + process.env.BZ_API_KEY
    }
    return requestJSON(url).then(function (body) {
      return body
    })
  }

}

if (require.main == module) {

  var bugNum = process.argv[2];
  var startDate = process.argv[3];
  var endDate = process.argv[4];

  if (startDate) {
    startDate = new Date(startDate)
  }
  if (endDate) {
    endDate = new Date(endDate)
  }

  module.exports.queryBugs({
    blocks: process.argv[2],
    include_fields: 'summary,is_open,creation_time,last_change_time',
  }).then(function (body) {
    var totalBugs = 0
    var openBugs = 0
    body.bugs.forEach(function(bug) {
      // Ignore bugs closed before start of period.
      if (startDate) {
        if (!bug.is_open && new Date(bug.last_change_time) < startDate) {
          return
        }
      }
      // Ignore bugs created after end of period.
      if (endDate) {
        if (new Date(bug.creation_time) > endDate) {
          return
        }
      }
      totalBugs += 1
      if (bug.is_open) {
        openBugs += 1
      }
    })
    console.log("Total bugs:", totalBugs);
    console.log("Open bugs:", openBugs);
    console.log("Percent complete:", Math.round((totalBugs - openBugs) / totalBugs * 10000 || 0) / 100 + '%')
  }).catch(function(err) {
    console.error('Error!')
    console.error(err)
  })
}
