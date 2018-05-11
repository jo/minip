const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const MemoryP = require('../memory-p')
const HttpP = require('../http-p')

const Ps = [
  MemoryP,
  HttpP
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)
  
    g.beforeEach(() => db.reset())

    g.test('returns a promise', t => db.allDocs())

    g.test('single document', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => db.allDocs())
        .then(response => {
          t.ok(Array.isArray(response), 'is an array')
          t.equal(response.length, 1, 'has single element')
          return response.shift()
        })
        .then(doc => {
          t.equal(doc._id, 'foo', '_id is correct')
          t.match(doc._rev, /^1-[a-f0-9]{32}$/, 'has a _rev 1')
          t.equal(doc.bar, 'baz', 'bar is baz')
        })
    })
    
    g.end()
  })
})


