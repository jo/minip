const { test } = require('tap')

const replicate = require('../replicate')

const MemoryP = require('../memory-p')
const HttpP = require('../http-p')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Pairs = [
  [MemoryP, MemoryP],
  [MemoryP, HttpP],
  [HttpP, MemoryP],
  [HttpP, HttpP]
]

const clean = (source, target) => {
  return Promise.all([source.reset(), target.reset()])
}

Pairs.forEach(([Source, Target]) => {
  test(`${Source.name} -> ${Target.name}`, g => {
    const source = new Source(url)
    const target = new Target(url)
  
    g.beforeEach(() => clean(source, target))

    g.test('replicates single document', t => {
      return source.bulkDocs([{ _id: 'foo', bar: 1 }])
        .then(() => replicate(source, target))
        .then(() => target.allDocs())
        .then(docs => {
          t.equal(docs.length, 1, 'single doc present on target')
          t.equal(docs[0]._id, 'foo', 'foo present on target')
        })
    })
    
    g.test('replicates multiple documents', t => {
      return source.bulkDocs([{ _id: 'foo', bar: 1 }, { _id: 'bar', bar: 1 }])
        .then(() => replicate(source, target))
        .then(() => target.allDocs())
        .then(docs => {
          t.equal(docs.length, 2, 'two docs present on target')
        })
    })
    
    g.test('replicates document update', t => {
      return source.bulkDocs([{ _id: 'foo', bar: 1 }])
        .then(([{ rev }]) => {
          return replicate(source, target)
            .then(() => source.bulkDocs([{ _id: 'foo', bar: 2, _rev: rev }]))
            .then(([{ rev }]) => {
              return replicate(source, target)
                .then(() => target.allDocs())
                .then(([doc]) => {
                  t.equal(doc._id, 'foo', 'foo present on target')
                  t.equal(doc._rev, rev, 'correct rev present on target')
                })
            })
        })
    })
    
    g.end()
  })
})
