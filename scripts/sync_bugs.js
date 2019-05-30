/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


// A script to mirror bugilla issues into github, where we
// can see them as part of our github-based planning procedure.
// Publicly-visible bugzilla bugs will appear in the target github
// repo with titles like "The Bug Summary [bz12345]" while private
// bugs show up as "confidential issue [b12345]".


var GH = require('./gh.js')
var P = require('bluebird')
var request = P.promisify(require('request'), { multiArgs: true })

var REPO = 'fxa'
var BZ_URL = 'https://bugzilla.mozilla.org/rest'
var BZ_VIEW_URL = 'https://bugzilla.mozilla.org/show_bug.cgi'
var BZ_QUERIES = [
  // Everything in "Cloud Services/Server: Firefox Accounts".
  'product=Cloud%20Services&component=Server:%20Firefox%20Accounts',
  // Anything with [fxa] in its whiteboard string.
  'whiteboard=[fxa]',
  // Anything with [fxa-waffle] in its whiteboard string.
  'whiteboard=[fxa-waffle]'
]
var BZ_STATUS_OPEN = [
  'UNCONFIRMED',
  'NEW',
  'ASSIGNED',
  'REOPENED'
]


function requestJSON(url) {
  return request(url).then(function (res) {
    if (res[0].statusCode !== 200) {
      var err = new Error("HTTP Request failed with status code " + res[0].statusCode)
      err.response = res[0]
      throw err
    }
    return JSON.parse(res[1])
  })
}


module.exports = {

  // Find all the issues in bugzilla that should be mirrors into github.
  // It's safe for this to use a private API key because we don't touch
  // any bug data, just the bug numbers.

  findIssuesInBugzilla: function findIssuesInBugzilla() {
    var bugs = {}
    return P.each(BZ_QUERIES, function(query) {
      // Fetch just enough fields to tell whether:
      //  * the bug may security-sensitive
      //  * the bug should be ignored
      var url = BZ_URL + '/bug?include_fields=id,groups,whiteboard,url'
      url += '&status=' + BZ_STATUS_OPEN.join('&status=')
      if (process.env.BZ_API_KEY) {
        url += '&api_key=' + process.env.BZ_API_KEY
      }
      url += '&' + query
      return requestJSON(url).then(function (body) {
        body.bugs.forEach(function (bug) {
          if (bug.whiteboard && bug.whiteboard.indexOf('[fxa-waffle-ignore]') !== -1) {
            console.log('Ignoring bz' + bug.id + ' due to [fxa-waffle-ignore]')
          } else if (bug.url && bug.url.indexOf('github.com/mozilla') !== -1) {
            console.log('Ignoring bz' + bug.id + ' due to linked github URL')
          } else {
            bugs[bug.id] = bug
          }
        })
      })
    }).then(function () {
      return bugs
    })
  },

  // Find all the issues in github that correspond to bugzilla bugs.
  // This depends on them being named in a consistent manner with
  // the [bz12345] suffix.

  findIssuesInGithub: function findIssuesInGithub(gh) {
    var bugs = {}
    return gh.issues.repoIssues({
      repo: REPO,
      state: 'open',
    }).then(function (issues) {
      return P.each(issues, function (issue) {
        var match = /\[bz(\d+)\]$/.exec(issue.title)
        if (match) {
          bugs[match[1]] = issue
        }
      })
    }).then(function () {
      return bugs
    })
  },

  // Sync the public details of a bug into github.
  // Note that we must not use an api_key here, to avoid leaking
  // e.g. security-sensitive info into github.

  syncPublicBugDetails: function syncPublicBugDetails(bugid, issue) {
    return requestJSON(BZ_URL + '/bug/' + bugid).then(
      function (bugInfo) {
        bugInfo = bugInfo.bugs[0]
        // Use the first comment as bug description, for extra context
        return requestJSON(BZ_URL + '/bug/' + bugid + '/comment').then(function(comments) {
          var descr = comments.bugs[bugid].comments[0].text
          return {
            title: bugInfo.summary + ' [bz' + bugid + ']',
            body: 'From ' + BZ_VIEW_URL + '?id=' + bugid + (descr ? '\n\n' + descr : '')
          }
        })
      },
      function (err) {
        // This might fail if it's in a security group.
        if (err.response && err.response.statusCode) {
          if (err.response.statusCode === 401) {
            return {
              title: 'confidential issue [bz' + bugid + ']',
              body: 'From ' + BZ_VIEW_URL + '?id=' + bugid
            }
          }
        }
        throw err
      }
    ).then(function (details) {
      details.repo = REPO
      if (!issue) {
        console.log('Creating mirror issue for bz' + bugid)
        return gh.issues.create(details)
      } else {
        if (issue.title !== details.title || issue.body !== details.body) {
          console.log('Updating mirror issue for bz' + bugid)
          details.number = issue.number
          return gh.issues.edit(details)
        }
      }
    })
  },

  // Sync the closed-ness of bugs from bugzilla to github.
  // This *can* use an api_key to detect closed security bugs,
  // but doesn't reflect any sensitive information into github.

  syncPublicBugStatus: function syncPublicBugStatus(bugid, issue) {
    var url = BZ_URL + '/bug/' + bugid + '?include_fields=id,is_open'
    if (process.env.BZ_API_KEY) {
      url += '&api_key=' + process.env.BZ_API_KEY
    }
    return requestJSON(url).then(
      function (bugInfo) {
        bugInfo = bugInfo.bugs[0]
        if (!bugInfo.is_open) {
          // It's closed, close it in github.
          console.log('Closing mirror issue for bz' + bugid)
          return gh.issues.edit({
            repo: REPO,
            number: issue.number,
            state: 'closed'
          })
        }
      },
      function (err) {
        if (err.response && err.response.statusCode) {
          if (err.response.statusCode === 404) {
            // That bug doesn't exist for some reason, close it in github.
            console.log('Closing mirror issue for bz' + bugid)
            return gh.issues.edit({
              repo: REPO,
              number: issue.number,
              state: 'closed'
            })
          }
        }
      }
    )
  }

}

if (require.main == module) {
  gh = new GH()
  var bzIssues, ghIssues
  // Find the sets of bugs in both places, to intersect them.
  module.exports.findIssuesInBugzilla().then(function (bugs) {
    //bzIssues = bugs
    bzIssues = [bugs[0]]
    return module.exports.findIssuesInGithub(gh)
  }).then(function (bugs) {
    ghIssues = bugs
    // Sync all bugzilla issues over into github.
    // We always update bugs with a group, in case it's a security
    // group that got recently added and we need to hurriedly change
    // the details in github to hide it.
    return P.each(Object.keys(bzIssues), function(bugid) {
      if (!ghIssues[bugid] || bzIssues[bugid].groups.length > 0) {
        return module.exports.syncPublicBugDetails(bugid, ghIssues[bugid])
      }
    })
  }).then(function () {
    // For any github issues that aren't in bugzilla,
    // see if we should close them out.
    return P.each(Object.keys(ghIssues), function(bugid) {
      if (!bzIssues[bugid]) {
        return module.exports.syncPublicBugStatus(bugid, ghIssues[bugid])
      }
    })
  }).catch(function(err) {
    console.log(err)
  })
}
