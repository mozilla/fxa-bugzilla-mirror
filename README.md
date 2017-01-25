
# Firefox Accounts Bugzilla Mirror

[![CircleCI](https://circleci.com/gh/mozilla/fxa-bugzilla-mirror.svg?style=svg)](https://circleci.com/gh/mozilla/fxa-bugzilla-mirror)

This is a little experiment in mirroring FxA-related
bugzilla bugs into github, so that we can view them
in our github-based work planning flow at:

  https://waffle.io/mozilla/fxa

It may turn out to be a bad idea, so don't get too
excited about it just yet...

## How do I get a bugzilla bug to show up in waffle?

You have three options:

* File it under product="Cloud Services" and component="Server: Firefox Accounts" in bugzilla;
  we mirror all bugs in that component by default.
* Add "[fxa-waffle]" to the bug's "whiteboard" field.
* Manually create the issue in the fxa-bugzilla-mirror repo, and put "[bzXXXXXXX]" in the title.

All such bugs will be dealth with by the bug-syncing script.
The script runs automatically for public bugs every day!
You can also run it by hand:

    node ./scripts/sync_bugs.js


