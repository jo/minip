const { test } = require('tap')
const pull = require('pull-stream')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Ps = [
  // require('../memory-p'),
  require('../http-p')
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)
  
    g.beforeEach(() => db.reset())

    g.test('viewer', t => {
      db.bulkDocs([{ _id: 'foo' }])
        .then(([{ rev }]) => {
          pull(
            db.viewer(),
            pull.collect((error, ids) => {
              t.error(error)
              t.same(ids, [null, { id: 'foo', rev }])
              t.end()
            })
          )
        })
    })

    g.test('reader', t => {
      db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => {
          pull(
            pull.values([{ id: 'foo' }]),
            db.reader(),
            pull.collect((error, docs) => {
              t.error(error)
              t.same(docs, [{ _id: 'foo', _rev: rev, bar: 'baz' }])
              t.end()
            })
          )
        })
    })

    g.test('writer', t => {
      pull(
        pull.values([{ _id: 'foo', bar: 'baz' }]),
        db.writer(),
        pull.collect((error, [doc]) => {
          t.error(error)
          t.equal
          t.match(doc, { ok: true, id: 'foo', rev: /.*/ })
          t.end()
        })
      )
    })

    g.end()
  })
})
