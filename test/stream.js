const { test } = require('tap')
const pull = require('pull-stream')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const stream = require('../stream')

const Ps = [
  require('../memory-p'),
  require('../http-p')
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)

    g.beforeEach(done => db.reset(done))

    g.test('reader', t => {
      db.write([{ _id: 'foo', bar: 'baz' }, { _id: 'bar', bar: 'qux' }], (error, [doc1, doc2]) => {
        t.error(error)
        pull(
          stream.reader(db)(),
          pull.collect((error, docs) => {
            t.error(error)
            t.same(docs, [null, { _id: 'bar', _rev: doc2.rev, bar: 'qux' }, { _id: 'foo', _rev: doc1.rev, bar: 'baz' }])
            t.end()
          })
        )
      })
    })

    g.test('writer', t => {
      pull(
        pull.values([{ _id: 'foo', bar: 'baz' }, { _id: 'bar', bar: 'qux' }]),
        stream.writer(db)(),
        pull.collect((error, [resp1, resp2]) => {
          t.error(error)
          t.match(resp1, { ok: true, id: 'foo', rev: /^1-[a-f0-9]{32}$/ })
          t.match(resp2, { ok: true, id: 'bar', rev: /^1-[a-f0-9]{32}$/ })
          t.end()
        })
      )
    })

    g.end()
  })
})
