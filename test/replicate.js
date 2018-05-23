const { test } = require('tap')
const pull = require('pull-stream')

const stream = require('../stream')

const replicate = (source, target) => {
  return pull(
    stream.reader(source)({ revs: true }),
    stream.writer(target)({ new_edits: false })
  )
}

const MemoryP = require('../memory-p')
const HttpP = require('../http-p')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Pairs = [
  [MemoryP, MemoryP],
  [MemoryP, HttpP],
  [HttpP, MemoryP],
  [HttpP, HttpP]
]

const clean = (source, target, done) => {
  source.reset(() => target.reset(() => done(null)))
}

Pairs.forEach(([Source, Target]) => {
  test(`${Source.name} -> ${Target.name}`, g => {
    const source = new Source(url)
    const target = new Target(url)

    g.beforeEach(done => clean(source, target, done))

    g.test('replicates single document', t => {
      source.write([{ _id: 'foo', bar: 1 }], (error) => {
        t.error(error)
        pull(
          replicate(source, target),
          pull.collect((error, docs) => {
            t.error(error)
            target.read((error, [doc]) => {
              t.error(error)
              t.equal(doc._id, 'foo', 'foo present on target')
              t.end()
            })
          })
        )
      })
    })

    g.test('replicates multiple documents', t => {
      source.write([{ _id: 'foo', bar: 1 }, { _id: 'bar', bar: 2 }], (error) => {
        t.error(error)
        pull(
          replicate(source, target),
          pull.collect((error, docs) => {
            t.error(error)
            target.read((error, [doc1, doc2, d]) => {
              t.error(error)
              t.ok(doc1, 'doc one present on target')
              t.ok(doc2, 'doc two present on target')
              t.end()
            })
          })
        )
      })
    })

    g.test('replicates document update', t => {
      source.write([{ _id: 'foo', bar: 1 }], (error, [{ rev }]) => {
        t.error(error)
        pull(
          replicate(source, target),
          pull.collect((error, docs) => {
            t.error(error)
            source.write([{ _id: 'foo', bar: 1, _rev: rev }], (error, [{ rev }]) => {
              t.error(error)
              pull(
                replicate(source, target),
                pull.collect((error, docs) => {
                  t.error(error)
                  target.read((error, [doc]) => {
                    t.error(error)
                    t.equal(doc._rev, rev, 'correct rev present on target')
                    t.end()
                  })
                })
              )
            })
          })
        )
      })
    })

    g.end()
  })
})
