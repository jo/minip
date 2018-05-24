# Mini P
Mini P (Berlin slang for mini pizza) is the very basics you needed to replicate
with a CouchDB. Its not something you would consider using in production in any
way.

[![Build Status](https://travis-ci.org/jo/minip.svg?branch=master)](https://travis-ci.org/jo/minip)

## Adapters
Mini P provides two adapters by now:

* MemoryP - in memory store
* HttpP - talks to a real CouchDB

both share the same interface.

## API
The API is just two methods:

* `read(options)`
* `write(docs, options)`

(and a `reset` used for testing)

### Options
* For `read` you pass `{ revs: true }` and get `_revisions` included in the documents
* For `write` you can pass `{ new_edits: false }` to circumvent optimistic locking

### Pull Streams
You can create pull-streams out of an adapter by calling `stream.reader(db)` or
`stream.writer(db)`.


## Replication
For replication you just pipe a `reader` stream into a `writer` stream:

```js
pull(
  stream.reader(source)({ revs: true }),
  stream.writer(target)({ new_edits: false })
)
```

The CouchDB replication protocol replicates documents via the changes feed.
This replication, though, is based on `allDocs` by now.

## Dependencies
Mini P requires Node v8.  
HttpP adapter only works with CouchDB 2 (relies on `_bulk_get`).  
The only npm dependency is `request`, which is used for the HttpP adapter.

## Example
```js
import { HttpP, MemoryP, stream } from 'minip'
import pull from 'pull-stream'
import onEnd from 'pull-stream/sinks/on-end'

const local = new MemoryP()
const remote = new HttpP('http://localhost:5984/mydb')

// write to local database
local.write([{ _id: 'foo', bar: 'baz' }], (error, response) => {
  // replicate local to remote
  pull(
    stream.reader(source)({ revs: true }),
    stream.writer(target)({ new_edits: false }),
    onEnd(() => {
      // once finished, query remote db
      remote.read((error, [doc]) => {
        // {
        //   _id: 'foo',
        //   _rev: '1-b3cec23b98d5f20d20a8279878ddce3d',
        //   bar: 'baz'
        // }
      })
    })
  )
})
```

## State of Mini P
### What Works
* Store and retrieve a bunch of docs
* Store docs with `new_edits: false`.
* Get docs with `revs: true`
* Update a doc, increment `_rev`
* choose winning rev
* replicating a whole database
* merge `_revisions` tree on `new_edits:false`

### What does not work
Everything else.

No changes feed. No views. Almost no error handling. No deletes. No
checkpointing. No revs diff. Hah: no attachments for sure.

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
