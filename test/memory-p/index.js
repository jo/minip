const { test } = require('tap')

const P = require('../../memory-p')

test('MemoryP', g => {
  g.test('store has basic objects', t => {
    const db = new P()

    t.type(db._store.ids, 'object', 'store has ids object')
    t.type(db._store.revs, 'object', 'store has revs object')
    t.end()
  })

  g.test('write', t => {
    const db = new P()

    db.write([{ _id: 'foo', bar: 'baz' }], (error, [response]) => {
      t.error(error)
      t.type(response, 'object', 'reponse is object')
      t.equal(response.id, 'foo', 'correct response id')
      t.end()
    })
  })

  g.test('write mutates store', t => {
    const db = new P()

    db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
      t.error(error)

      const revId = rev.split('-')[1]

      t.ok(revId in db._store.revs, 'revision is in revs')
      t.ok('body' in db._store.revs[revId], 'doc in revs')
      t.equal(db._store.revs[revId].body.bar, 'baz', 'bar is set')

      t.ok('foo' in db._store.ids, 'foo in ids')
      t.equal(db._store.ids.foo.winner, revId, 'winner is set to revision')

      t.end()
    })
  })

  g.test('update mutates store', t => {
    const db = new P()

    db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
      t.error(error)

      const revId1 = rev.split('-')[1]

      db.write([{ _id: 'foo', bar: 'qux', _rev: rev }], (error, [{ rev }]) => {
        t.error(error)

        const revId2 = rev.split('-')[1]

        t.ok(revId2 in db._store.revs, 'revision is in revs')
        t.ok('body' in db._store.revs[revId2], 'doc in revs')
        t.equal(db._store.revs[revId2].body.bar, 'qux', 'bar is set')
        t.equal(db._store.revs[revId2].parent, revId1, 'parent is set to rev1')

        t.ok('foo' in db._store.ids, 'foo in ids')
        t.equal(db._store.ids.foo.winner, revId2, 'winner is set to revision')

        t.end()
      })
    })
  })

  g.test('read', t => {
    const db = new P()

    db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
      t.error(error)
      db.read((error, [doc]) => {
        t.error(error)
        t.same(doc, {
          _id: 'foo',
          bar: 'baz',
          _rev: rev
        })
        t.end()
      })
    })
  })

  g.test('calculate revision', t => {
    const db = new P()

    db.write([{ _id: 'foo', bar: 'baz' }], (error, [{rev}]) => {
      t.error(error)
      t.equal(rev, '1-033b807a53829e3ff967933a25d26dbb', 'correct revision calculated')
      t.end()
    })
  })

  g.end()
})
