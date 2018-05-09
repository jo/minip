# Mini P
Mini P is a very basics you needed to replicate with a CouchDB. Its not
something you would consider using in production in any way. Mini P is a
playground, a learning project created mostly for myself.

Back in the days when we were young we used to hangout all nights long at a
place we called Schlemmerdreieck, a place with several fast food direct at
U-Schlesisches Tor, in Berlin Kreuzberg.
We watched the beginning of the new age, followed the crowds passing by with
our eyes. And we consumed masses of Mini P (Minipizza) while drinking beer.
Those were the times of us being young, the world was open, we were 20 forever
and thought we could do everything.

Lets write a datastore from scratch, which can sync with Apache CouchDB and
does not break further replication. And nothing more. Everything is allowed as
long as it does not mess with the database in incompatible ways.

**Let's make it out of NodeJS and pour it in Rust.**

This very first attempts on this does not do optimistic locking. It will just
increment the revision number and calculate a new deterministic revision hash
based on the content.

A winning rev algorithm for now is purely based on the numerical and
alphabetical order of revisions.

The api is nothing but the methods needed for replication:

* `allDocs(options)`
* `bulkDocs(docs, options)`
* `bulkGet(docs, options)`

For `bulkDocs` you can pass `{ new_edits: false }` to circumvent new revision
assignment.

For `bulkGet` you pass `{ revs: true }` and get the rev tree.

Mini P will not save you from anything. There is exactly zero error handling.
And there is zero beautification. But what comes - who knows?

Mini P requires Node v8.

The development process is pretty straight forward:
* Write a test and break Mini P
* Fix Mini P

## What Works
* Store and retrieve a bunch of docs
* Store docs with `new_edits: false`.
* Get docs with `revs: true`
* Update a doc, increment `_rev`
* choose winning rev


## What does not work
Everything.

No changes feed atm. No views. No optimistic locking (no locking at all). No
error handling. No conflicts.

## Tests
Additionaly to the tests a `npm run test:perf` task provides you with some
numbers for throughput.


(c) 2018 J. J. Schmidt
