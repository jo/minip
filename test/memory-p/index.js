const { test } = require('tap')

const MemoryP = require('../../memory-p')

const db = new MemoryP()

test('returns a promise', t => db.bulkDocs())

test('mutates store', t => {
  const doc = {_id: 'foo', bar: 'baz' }

  return db.bulkDocs([doc])
    .then(response => {
      const _rev = response[0].rev

      t.type(db._store.foo, 'object', 'object `foo`')
      t.type(db._store.foo.revMap, 'object', 'object `foo.revMap`')
    })
})
