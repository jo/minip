const { test } = require('tap')

const Minipouch = require('..')

const db = new Minipouch()

test('returns a promise', t => db.bulkDocs())

test('single document insert', g => {
  const doc = {_id: 'foo', bar: 'baz' }

  return db.bulkDocs([doc])
    .then(response => {
      const _rev = response[0].rev

      g.test('returns a response', t => {
        t.ok(Array.isArray(response), 'is an array')
        t.equal(response.length, 1, 'has single element')
        t.end()
      })

      g.test('mutates _docsById', t => {
        t.type(db._docsById.foo, 'object', 'object `foo`')
        t.type(db._docsById.foo.revMap, 'object', 'object `foo.revMap`')
        t.end()
      })

      g.test('first response element', t => {
        t.ok(response[0].ok, 'is ok')
        t.equal(response[0].id, 'foo', 'has correct id')
        t.match(_rev, /^1-[a-f0-9]{32}$/, 'has a first rev')
        t.end()
      })

      return db.bulkDocs([{ ...doc, _rev, bar: 'gone' }])
        .then(([response]) => {
          const newRev = response.rev

          g.match(newRev, /^2-[a-f0-9]{32}$/, 'has a second rev')
          g.equal(response.id, 'foo', 'correct id')

          return db.allDocs()
            .then(([doc]) => {
              g.test('find latest revision', t => {
                t.equal(doc._id, 'foo', 'correct id')
                t.equal(doc._rev, newRev, 'has a second rev')
                t.equal(doc.bar, 'gone', 'bar is set to gone')
                t.end()
              })
            })
        })
    })
})

test('document insert with new_edits:false', t => {
  const doc = {_id: 'foo', bar: 'baz', _rev: '3-abc' }

  return db.bulkDocs([doc], { new_edits: false })
    .then(([response]) => {
      t.equal(response.id, 'foo', 'correct id')
      t.equal(response.rev, '3-abc', 'correct rev')
    })
})
