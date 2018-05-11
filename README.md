# Mini P
Mini P (german abbr for Mini Pizza) is the very basics you needed to replicate
with a CouchDB. Its not something you would consider using in production in any
way. Mini P is a playground, a learning project.

## Adapters
Mini P provides two adapters by now:

* MemoryP - in memory store
* HttpP - talks to a real CouchDB

both share the same interface.

## API
The API is nothing but the methods needed for replication:

* `allDocs(options)`
* `bulkDocs(docs, options)`
* `bulkGet(docs, options)`

API is a subset of CouchDB's API which is the absolute essential for
replication. It's aligned to CouchDB API as near as possible.

* For `bulkDocs` you can pass `{ new_edits: false }` to circumvent optimistic locking
* For `bulkGet` you pass `{ revs: true }` and get the rev tree.
* For `allDocs` and `bulkGet` you pass `{ conflicts: true }` and get the conflicts.

## Replication
And you get a `replicate(source, target)` API, which replicates an entire database.

The CouchDB replication protocol replicates documents via the changes feed. This replication implementation, though, is based on `allDocs` by now.

## Dependencies
Mini P requires Node v8.

## Example
```js
import { HttpP, MemoryP, replicate } from 'minip'

const local = new MemoryP()
const remote = new HttpP('http://localhost:5984/mydb')

local.bulkDocs([{ _id: 'foo', bar: 'baz' }])
  .then(() => replicate(local, remote))
  .then(() => remote.allDocs())
  .then(([doc]) => console.log(doc))
  // {
  //   _id: 'foo',
  //   _rev: '1-b3cec23b98d5f20d20a8279878ddce3d',
  //   bar: 'baz'
  // }
```

## State of Mini P
### What Works
* Store and retrieve a bunch of docs
* Store docs with `new_edits: false`.
* Get docs with `revs: true`
* Update a doc, increment `_rev`
* choose winning rev
* replicating a whole database

### What does not work
Everything else.

No changes feed atm. No views. Almost no error handling. No rev tree merge. No
deletes. No checkpointing. No revs diff. Hah, no attachments for sure.

### Whats next
1. merge revtree
2. deletions
3. revsDiff

## Development
The development process is pretty straight forward:
* Write a test and works with HttpP break MemoryP
* Fix MemoryP

### Tests
Additionaly to `npm test` a `npm run test:perf` task provides you with some
numbers for throughput.

All tests run against all adapters. Replication is tested across all adapter
combinations.


(c) 2018 J. J. Schmidt
