const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Ps = [
  require('../memory-p'),
  require('../http-p')
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)

    g.beforeEach(done => db.reset(done))

    g.test('document creation', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error) => {
        t.error(error)
        db.read({ revs: true }, (error, [doc]) => {
          t.error(error)
          t.equal(doc._id, 'foo', '_id is correct')
          t.match(doc._rev, /^1-[a-f0-9]{32}$/, 'has a _rev 1')
          t.equal(doc.bar, 'baz', 'bar is baz')
          t.notOk(doc._conflicts, 'no conflicts')
          t.same(doc._revisions, {
            start: 1,
            ids: [doc._rev.split('-')[1]]
          }, '_revisions set correctly')
          t.end()
        })
      })
    })

    g.test('document update', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
        t.error(error)
        const revId1 = rev.split('-')[1]
        db.write([{ _id: 'foo', _rev: rev, bar: 'qux' }], (error, [{ rev }]) => {
          t.error(error)
          const revId2 = rev.split('-')[1]
          db.read({ revs: true }, (error, [doc]) => {
            t.error(error)
            t.match(doc._rev, /^2-[a-f0-9]{32}$/, 'has a _rev 2')
            t.equal(doc.bar, 'qux', 'bar is qux')
            t.notOk(doc._conflicts, 'no conflicts')
            t.same(doc._revisions, {
              start: 2,
              ids: [revId2, revId1]
            }, '_revisions set correctly')
            t.end()
          })
        })
      })
    })

    g.test('two document updates', t => {
      db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
        t.error(error)
        const revId1 = rev.split('-')[1]
        db.write([{ _id: 'foo', _rev: rev, bar: 'qux' }], (error, [{ rev }]) => {
          t.error(error)
          const revId2 = rev.split('-')[1]
          db.write([{ _id: 'foo', _rev: rev, bar: 'quux' }], (error, [{ rev }]) => {
            t.error(error)
            const revId3 = rev.split('-')[1]
            db.read({ revs: true }, (error, [doc]) => {
              t.error(error)
              t.match(doc._rev, /^3-[a-f0-9]{32}$/, 'has a _rev 3')
              t.equal(doc.bar, 'quux', 'bar is quux')
              t.notOk(doc._conflicts, 'no conflicts')
              t.same(doc._revisions, {
                start: 3,
                ids: [revId3, revId2, revId1]
              }, '_revisions set correctly')
              t.end()
            })
          })
        })
      })
    })

    g.test('document update conflict', s => {
      s.test('missing rev', t => {
        db.write([{ _id: 'foo', bar: 'baz' }], (error) => {
          t.error(error)
          db.write([{ _id: 'foo', bar: 'qux' }], (error, [response]) => {
            t.error(error)
            t.equal(response.error, 'conflict', 'Document update conflict.')
            t.end()
          })
        })
      })

      s.test('revision mismatch', t => {
        db.write([{ _id: 'foo', bar: 'baz' }], (error) => {
          t.error(error)
          db.write([{ _id: 'foo', bar: 'qux', _rev: '1-a' }], (error, [response]) => {
            t.error(error)
            t.equal(response.error, 'conflict', 'Document update conflict.')
            t.end()
          })
        })
      })

      s.end()
    })

    g.test('new_edits: false', s => {
      s.test('missing rev', t => {
        t.throws(() => {
          db.write([{ _id: 'foo', bar: 'baz' }], { new_edits: false }, (error) => {
            t.error(error)
            t.ok(false, 'nope')
          })
        }, 'errors')
        t.end()
      })

      s.test('document creation', t => {
        db.write([{ _id: 'foo', bar: 'baz', _rev: '1-abc' }], { new_edits: false }, (error) => {
          t.error(error)
          db.read({ conflicts: true, revs: true }, (error, [doc]) => {
            t.error(error)
            t.equal(doc._id, 'foo', '_id is correct')
            t.equal(doc._rev, '1-abc', 'has correct rev')
            t.equal(doc.bar, 'baz', 'bar is baz')
            t.notOk(doc._conflicts, 'no conflicts')
            t.same(doc._revisions, {
              start: 1,
              ids: ['abc']
            }, '_revisions set correctly')
            t.end()
          })
        })
      })

      s.test('document update with lower rev', t => {
        db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
          t.error(error)
          const revId = rev.split('-')[1]
          db.write([{ _id: 'foo', bar: 'qux', _rev: '1-00000000000000000000000000000000' }], { new_edits: false }, (error) => {
            t.error(error)
            db.read({ conflicts: true, revs: true }, (error, [doc]) => {
              t.error(error)
              t.equal(doc._rev, rev, 'has correct rev')
              t.equal(doc.bar, 'baz', 'bar is baz')
              t.same(doc._conflicts, [
                '1-00000000000000000000000000000000'
              ], 'correct _conflicts')
              t.same(doc._revisions, {
                start: 1,
                ids: [revId]
              }, '_revisions set correctly')
              t.end()
            })
          })
        })
      })

      s.test('document update with higher rev id', t => {
        db.write([{ _id: 'foo', bar: 'baz' }], (error, [{ rev }]) => {
          t.error(error)
          db.write([{ _id: 'foo', bar: 'qux', _rev: '1-ffffffffffffffffffffffffffffffff' }], { new_edits: false }, (error) => {
            t.error(error)
            db.read({ conflicts: true, revs: true }, (error, [doc]) => {
              t.error(error)
              t.equal(doc._rev, '1-ffffffffffffffffffffffffffffffff', 'has correct rev')
              t.equal(doc.bar, 'qux', 'bar is qux')
              t.same(doc._conflicts, [
                rev
              ], 'correct _conflicts')
              t.same(doc._revisions, {
                start: 1,
                ids: ['ffffffffffffffffffffffffffffffff']
              }, '_revisions set correctly')
              t.end()
            })
          })
        })
      })

      s.test('document update with _revisions', t => {
        db.write([{ _id: 'foo', bar: 'baz', _rev: '1-abc' }, { _id: 'foo', bar: 'qux', _rev: '1-def' }], { new_edits: false }, (error) => {
          t.error(error)
          db.write([{ _id: 'foo', bar: 'qux', _rev: '2-ghi', _revisions: { start: 2, ids: ['ghi', 'abc'] } }], { new_edits: false }, (error) => {
            t.error(error)
            db.read({ conflicts: true, revs: true }, (error, [doc]) => {
              t.error(error)
              t.equal(doc._rev, '2-ghi', 'has correct rev')
              t.equal(doc.bar, 'qux', 'bar is qux')
              t.same(doc._conflicts, [
                '1-def'
              ], 'correct _conflicts')
              t.same(doc._revisions, {
                start: 2,
                ids: ['ghi', 'abc']
              }, '_revisions set correctly')
              t.end()
            })
          })
        })
      })

      s.end()
    })

    g.test('conflicts', s => {
      s.test('choose correct winning ref', t => {
        db.write([{ _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 1, _rev: '1-abc' }], { new_edits: false }, (error) => {
          t.error(error)
          db.read({ conflicts: true, revs: true }, (error, [doc]) => {
            t.error(error)
            t.equal(doc._rev, '1-def', 'correct winning rev is choosen')
            t.end()
          })
        })
      })

      s.test('simple conflict', t => {
        db.write([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }], { new_edits: false }, (error) => {
          t.error(error)
          db.read({ conflicts: true, revs: true }, (error, [doc]) => {
            t.error(error)
            t.same(doc._conflicts, [
              '1-abc'
            ], 'correct _conflicts')
            t.end()
          })
        })
      })

      s.test('two conflicting revisions', t => {
        db.write([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false }, (error) => {
          t.error(error)
          db.read({ conflicts: true, revs: true }, (error, [doc]) => {
            t.error(error)
            t.same(doc._conflicts, [
              '1-def',
              '1-abc'
            ], 'correct _conflicts')
            t.end()
          })
        })
      })

      s.test('two conflicting revisions, then update winning rev', t => {
        db.write([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false }, (error) => {
          t.error(error)
          db.write([{ _id: 'foo', n: 4, _rev: '1-ghi' }], (error) => {
            t.error(error)
            db.read({ conflicts: true, revs: true }, (error, [doc]) => {
              t.error(error)
              t.same(doc._conflicts, [
                '1-def',
                '1-abc'
              ], 'correct _conflicts')
              t.end()
            })
          })
        })
      })

      s.end()
    })

    g.end()
  })
})
