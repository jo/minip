const { test } = require('tap')

const Minipouch = require('..')

const db = new Minipouch()

test('returns a promise', t => db.allDocs())

test('response', t => {
  return db.allDocs()
    .then(response => {
      t.ok(Array.isArray(response), 'is an array')
      t.equal(response.length, 0, 'has no elements')
    })
})

test('db contains single entry', t => {
  return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
    .then(() => db.allDocs())
    .then(response => {
      t.ok(Array.isArray(response), 'is an array')
      t.equal(response.length, 1, 'has single element')
      return response.shift()
    })
    .then(doc => {
      t.equal(doc._id, 'foo', '_id is ok')
      t.match(doc._rev, /^\d+-[a-f0-9]{32}$/, 'has a _rev')
      t.equal(doc.bar, 'baz', 'bar is baz')
    })
})
