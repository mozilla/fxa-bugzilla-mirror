
# Firefox Accounts Bugzilla Mirror

[![CircleCI](https://circleci.com/gh/mozilla/fxa-bugzilla-mirror.svg?style=svg)](https://circleci.com/gh/mozilla/fxa-bugzilla-mirror)

This is a little experiment in mirroring FxA-related
bugzilla bugs into github, so that we can view them
in our github-based work planning flow at:

  https://github.com/mozilla/fxa/issues

It may turn out to be a bad idea, so don't get too
excited about it just yet...

## How do I get a bugzilla bug to show up in waffle?

* Add "[fxa]" to the bug's "whiteboard" field.
* Add "[fxa-waffle]" to the bug's "whiteboard" field.

All such bugs will be dealt with by the bug-syncing script.
The script runs automatically for public bugs every day!
You can also run it by hand:

    node ./scripts/sync_bugs.js


