const { test } = require('tap')

const P = require('../../memory-p')

test('MemoryP', g => {
  g.test('store has basic objects', t => {
    const db = new P()

    t.type(db._store.ids, 'object', 'store has ids object')
    t.type(db._store.revs, 'object', 'store has revs object')
    t.end()
  })

  g.test('calculate revision', t => {
    const db = new P()

    return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
      .then(([{ rev }]) => {
        t.equal(rev, '1-033b807a53829e3ff967933a25d26dbb', 'correct revision calculated')
      })
  })

  g.test('create', t => {
    const db = new P()

    return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
      .then(([{ rev }]) => {
        const [_, revId] = rev.split('-')

        t.ok(revId in db._store.revs, 'revision is in revs')
        t.ok('body' in db._store.revs[revId], 'doc in revs')
        t.equal(db._store.revs[revId].body.bar, 'baz', 'bar is set')

        t.ok('foo' in db._store.ids, 'foo in ids')
        t.equal(db._store.ids.foo.winner, revId, 'winner is set to revision')
      })
  })

  g.test('update', t => {
    const db = new P()

    return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
      .then(([{ rev }]) => {
        const [_, revId1] = rev.split('-')

        return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: rev }])
          .then(([{ rev }]) => {
            const [_, revId2] = rev.split('-')

            t.ok(revId2 in db._store.revs, 'revision is in revs')
            t.ok('body' in db._store.revs[revId2], 'doc in revs')
            t.equal(db._store.revs[revId2].body.bar, 'qux', 'bar is set')
            t.equal(db._store.revs[revId2].parent, revId1, 'parent is set to rev1')

            t.ok('foo' in db._store.ids, 'foo in ids')
            t.equal(db._store.ids.foo.winner, revId2, 'winner is set to revision')
          })
      })
  })

  g.end()
})
