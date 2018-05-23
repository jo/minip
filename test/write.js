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

    g.test('document insert response', t => {
      const doc = { _id: 'foo', bar: 'baz' }

      db.write([doc], (error, response) => {
        t.error(error)

        t.ok(Array.isArray(response), 'response is an array')
        t.equal(response.length, 1, 'response has single element')

        t.ok(response[0].ok, 'first response is ok')
        t.equal(response[0].id, 'foo', 'first response has correct id')
        t.match(response[0].rev, /^1-[a-f0-9]{32}$/, 'first response has a first rev')

        t.end()
      })
    })

    g.test('document insert', t => {
      const doc = { _id: 'foo', bar: 'baz' }

      db.write([doc], (error, [{ rev }]) => {
        t.error(error)

        db.read((error, [doc]) => {
          t.error(error)

          t.equal(doc._id, 'foo', 'correct id')
          t.equal(doc._rev, rev, 'has correct second rev')
          t.equal(doc.bar, 'baz', 'bar is set to baz')

          t.end()
        })
      })
    })

    g.test('document update', t => {
      const doc = { _id: 'foo', bar: 'baz' }

      db.write([doc], (error, [{ rev }]) => {
        t.error(error)

        db.write([{ ...doc, _rev: rev, bar: 'gone' }], (error, [response]) => {
          t.error(error)

          const newRev = response.rev

          t.match(newRev, /^2-[a-f0-9]{32}$/, 'has a second rev')
          t.equal(response.id, 'foo', 'correct id')

          db.read((error, [doc]) => {
            t.error(error)

            t.equal(doc._id, 'foo', 'correct id')
            t.equal(doc._rev, newRev, 'has a second rev')
            t.equal(doc.bar, 'gone', 'bar is set to gone')

            t.end()
          })
        })
      })
    })

    g.test('document insert with new_edits:false', t => {
      const doc = { _id: 'foo', bar: 'baz', _rev: '3-abc' }

      db.write([doc], { new_edits: false }, (error, response) => {
        t.error(error)
        db.read((error, [doc]) => {
          t.error(error)

          t.equal(doc._id, 'foo', 'correct id')
          t.equal(doc._rev, '3-abc', 'has correct rev')
          t.equal(doc.bar, 'baz', 'bar is correct')

          t.end()
        })
      })
    })

    g.end()
  })
})
