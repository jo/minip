const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Ps = [
  require('../memory-p'),
  require('../http-p')
]

// get a doc with revs and conflicts
const get = (db, id) => {
  return db.allDocs({ conflicts: true })
    .then(docs => {
      return docs.filter(doc => doc._id === id)[0]
    })
    .then(doc => {
      return db.bulkGet([{ id: doc._id, rev: doc._rev }], { revs: true })
        .then(([{ docs: [{ ok }] }]) => ({ ...ok, _conflicts: doc._conflicts }))
    })
}

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)

    g.beforeEach(() => db.reset())

    g.test('document creation', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => get(db, 'foo'))
        .then(doc => {
          t.equal(doc._id, 'foo', '_id is correct')
          t.match(doc._rev, /^1-[a-f0-9]{32}$/, 'has a _rev 1')
          t.equal(doc.bar, 'baz', 'bar is baz')

          t.notOk(doc._conflicts, 'no conflicts')
          t.same(doc._revisions, {
            start: 1,
            ids: [doc._rev.split('-')[1]]
          }, '_revisions set correctly')
        })
    })

    g.test('document update', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => {
          const revId1 = rev.split('-')[1]

          return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: rev }])
            .then(() => get(db, 'foo'))
            .then(doc => {
              t.equal(doc._id, 'foo', '_id is correct')
              t.match(doc._rev, /^2-[a-f0-9]{32}$/, 'has a _rev 2')
              t.equal(doc.bar, 'qux', 'bar is qux')

              const revId2 = doc._rev.split('-')[1]

              t.notOk(doc._conflicts, 'no conflicts')
              t.same(doc._revisions, {
                start: 2,
                ids: [revId2, revId1]
              }, '_revisions set correctly')
            })
        })
    })

    g.test('two document updates', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => {
          const revId1 = rev.split('-')[1]

          return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: rev }])
            .then(([{ rev }]) => {
              const revId2 = rev.split('-')[1]

              return db.bulkDocs([{ _id: 'foo', bar: 'bun', _rev: rev }])
                .then(() => get(db, 'foo'))
                .then(doc => {
                  t.match(doc._rev, /^3-[a-f0-9]{32}$/, 'has a _rev 3')

                  const revId3 = doc._rev.split('-')[1]

                  t.notOk(doc._conflicts, 'no conflicts')
                  t.same(doc._revisions, {
                    start: 3,
                    ids: [revId3, revId2, revId1]
                  }, '_revisions set correctly')
                })
            })
        })
    })

    g.test('document update conflict', s => {
      s.test('missing rev', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(() => db.bulkDocs([{ _id: 'foo', bar: 'qux' }]))
          .then(([response]) => {
            // console.log(JSON.stringify(response))
            // {
            //   "id": "foo",
            //   "error": "conflict",
            //   "reason": "Document update conflict."
            // }
            t.equal(response.error, 'conflict', 'Document update conflict.')
          })
      })

      s.test('revision mismatch', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(() => db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: '1-a' }]))
          .then(([response]) => {
            // console.log(JSON.stringify(response))
            // {
            //   "id": "foo",
            //   "error": "conflict",
            //   "reason": "Document update conflict."
            // }
            t.equal(response.error, 'conflict', 'Document update conflict.')
          })
      })

      s.end()
    })

    g.test('new_edits: false', s => {
      s.test('missing rev', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(() => db.bulkDocs([{ _id: 'foo', bar: 'qux' }], { new_edits: false }))
          .then(() => t.error('nope', 'should fail instead'))
          .catch(e => t.pass('errored'))
      })

      s.test('document creation', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz', _rev: '1-abc' }], { new_edits: false })
          .then(() => get(db, 'foo'))
          .then(doc => {
            t.equal(doc._id, 'foo', '_id is correct')
            t.equal(doc._rev, '1-abc', 'has correct rev')
            t.equal(doc.bar, 'baz', 'bar is baz')

            t.notOk(doc._conflicts, 'no conflicts')
            t.same(doc._revisions, {
              start: 1,
              ids: ['abc']
            }, '_revisions set correctly')
          })
      })

      s.test('document update with lower rev', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(([{ rev }]) => {
            const revId = rev.split('-')[1]

            return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: '1-00000000000000000000000000000000' }], { new_edits: false })
              .then(() => get(db, 'foo'))
              .then(doc => {
                t.equal(doc._rev, rev, 'has correct rev')
                t.equal(doc.bar, 'baz', 'bar is baz')

                t.same(doc._conflicts, [
                  '1-00000000000000000000000000000000'
                ], 'correct _conflicts')
                t.same(doc._revisions, {
                  start: 1,
                  ids: [revId]
                }, '_revisions set correctly')
              })
          })
      })

      s.test('document update with higher rev id', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(([{ rev }]) => {
            return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: '1-ffffffffffffffffffffffffffffffff' }], { new_edits: false })
              .then(() => get(db, 'foo'))
              .then(doc => {
                t.equal(doc._rev, '1-ffffffffffffffffffffffffffffffff', 'has correct rev')
                t.equal(doc.bar, 'qux', 'bar is qux')

                t.same(doc._conflicts, [
                  rev
                ], 'correct _conflicts')
                t.same(doc._revisions, {
                  start: 1,
                  ids: ['ffffffffffffffffffffffffffffffff']
                }, '_revisions set correctly')
              })
          })
      })

      s.test('document update with _revisions', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz', _rev: '1-abc' }, { _id: 'foo', bar: 'qux', _rev: '1-def' }], { new_edits: false })
          .then(() => {
            return db.bulkDocs([{ _id: 'foo', bar: 'qux', _rev: '2-ghi', _revisions: { start: 2, ids: ['ghi', 'abc'] } }], { new_edits: false })
              .then(() => get(db, 'foo'))
              .then(doc => {
                t.equal(doc._rev, '2-ghi', 'has correct rev')
                t.equal(doc.bar, 'qux', 'bar is qux')

                t.same(doc._conflicts, [
                  '1-def'
                ], 'correct _conflicts')
                t.same(doc._revisions, {
                  start: 2,
                  ids: ['ghi', 'abc']
                }, '_revisions set correctly')
              })
          })
      })

      s.end()
    })

    g.test('conflicts', s => {
      s.test('choose correct winning ref', t => {
        return db.bulkDocs([{ _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 1, _rev: '1-abc' }], { new_edits: false })
          .then(() => get(db, 'foo'))
          .then(doc => {
            t.equal(doc._rev, '1-def', 'correct winning rev is choosen')
          })
      })

      s.test('simple conflict', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }], { new_edits: false })
          .then(() => get(db, 'foo'))
          .then(doc => {
            t.same(doc._conflicts, [
              '1-abc'
            ], 'correct _conflicts')
          })
      })

      s.test('two conflicting revisions', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false })
          .then(() => get(db, 'foo'))
          .then(doc => {
            t.same(doc._conflicts, [
              '1-def',
              '1-abc'
            ], 'correct _conflicts')
          })
      })

      s.test('two conflicting revisions, then update winning rev', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false })
          .then(() => db.bulkDocs([{ _id: 'foo', n: 4, _rev: '1-ghi' }]))
          .then(() => get(db, 'foo'))
          .then(doc => {
            t.same(doc._conflicts, [
              '1-def',
              '1-abc'
            ], 'correct _conflicts')
          })
      })

      s.end()
    })

    g.end()
  })
})
