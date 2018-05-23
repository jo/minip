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

    g.beforeEach(done => db.reset(done))

    g.test('single element', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error) => {
        t.error(error)

        db.read((error, response) => {
          t.error(error)

          t.ok(Array.isArray(response), 'is an array')
          t.equal(response.length, 1, 'has single element')

          t.end()
        })
      })
    })

    g.test('single document', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error) => {
        t.error(error)

        db.read((error, [doc]) => {
          t.error(error)

          t.equal(doc._id, 'foo', '_id is correct')
          t.match(doc._rev, /^1-[a-f0-9]{32}$/, 'has a _rev 1')
          t.equal(doc.bar, 'baz', 'bar is baz')

          t.end()
        })
      })
    })

    g.test('revs true', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
        t.error(error)

        db.write([{ _id: 'foo', _rev: rev, bar: 'baz', banane: true }], (error) => {
          t.error(error)

          db.read({ revs: true }, (error, [{ _revisions }]) => {
            t.error(error)

            t.type(_revisions, 'object', '_revisions is an object')
            t.equal(_revisions.start, 2, 'start is correct')
            t.ok(Array.isArray(_revisions.ids), 'ids is an array')
            t.equal(_revisions.ids.length, 2, 'ids contains single entry')
            t.match(_revisions.ids[0], /^[a-f0-9]{32}$/, 'first id look like a rev')
            t.match(_revisions.ids[1], /^[a-f0-9]{32}$/, 'second id look like a rev')

            t.end()
          })
        })
      })
    })

    g.end()
  })
})
