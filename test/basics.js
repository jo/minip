const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Ps = [
  require('../memory-p'),
  require('../http-p')
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)
  
    g.beforeEach(() => db.reset())

    g.test('allDocs returns a promise', t => db.allDocs())
    g.test('bulkDocs returns a promise', t => db.bulkDocs())

    g.test('document creation', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => db.allDocs())
        .then(response => {
          t.ok(Array.isArray(response), 'is an array')
          t.equal(response.length, 1, 'has single element')
          return response.shift()
        })
        .then(doc => {
          t.equal(doc._id, 'foo', '_id is correct')
          t.match(doc._rev, /^1-[a-f0-9]{32}$/, 'has a _rev 1')
          t.equal(doc.bar, 'baz', 'bar is baz')
        })
    })

    g.test('document update', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: rev }]))
        .then(() => db.allDocs())
        .then(([doc]) => {
          t.match(doc._rev, /^2-[a-f0-9]{32}$/, 'has a _rev 2')
          t.equal(doc.bar, 'barz', 'bar is barz')
        })
    })

    g.test('two document updates', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: rev }]))
        .then(([{ rev }]) => db.bulkDocs([{ _id: 'foo', bar: 'bun', _rev: rev }]))
        .then(() => db.bulkGet([{ id: 'foo' }], { revs: true }))
        .then(([{docs: [{ ok }]}]) => {
          // console.log(JSON.stringify(ok))
          // {
          //   "_id": "foo",
          //   "_rev": "3-cafb43d11b9fd279011abb24ba9fda2d",
          //   "bar": "bun",
          //   "_revisions": {
          //     "start": 3,
          //     "ids": [
          //       "cafb43d11b9fd279011abb24ba9fda2d",
          //       "b5c06e3c7526cb861ea380d8193c2d1c",
          //       "c86e975fffb4a635eed6d1dfc92afded"
          //     ]
          //   }
          // }
          t.match(ok._rev, /^3-[a-f0-9]{32}$/, 'has a _rev 3')
          t.equal(ok._revisions.start, 3, 'correct start _revisions')
          t.equal(ok._revisions.ids[0], ok._rev.split('-')[1], 'correct first _revisions id')
        })
    })

    g.test('document update with missing rev', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => db.bulkDocs([{ _id: 'foo', bar: 'barz' }]))
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

    g.test('document update conflict', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: '1-a' }]))
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

    g.test('new_edits: false', s => {
      s.test('missing rev', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(() => db.bulkDocs([{ _id: 'foo', bar: 'barz' }], { new_edits: false }))
          .then(() => t.error('nope', 'should fail instead'))
          .catch(e => t.pass('errored'))
      })

      s.test('document creation', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz', _rev: '1-abc' }], { new_edits: false })
          .then(() => db.allDocs())
          .then(([doc]) => {
            t.equal(doc._id, 'foo', '_id is correct')
            t.equal(doc._rev, '1-abc', 'has correct rev')
            t.equal(doc.bar, 'baz', 'bar is baz')
          })
      })
    
      s.test('document update with lower rev', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(([{ rev }]) => {
            return db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: '1-000' }], { new_edits: false })
              .then(() => db.allDocs())
              .then(([doc]) => {
                t.equal(doc._rev, rev, 'has correct rev')
                t.equal(doc.bar, 'baz', 'bar is baz')
              })
          })
      })

      s.test('document update with higher rev id', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(([{ rev }]) => {
            return db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: '1-ffffffffffffffffffffffffffffffff' }], { new_edits: false })
              .then(() => db.allDocs())
              .then(([doc]) => {
                t.equal(doc._rev, '1-ffffffffffffffffffffffffffffffff', 'has correct rev')
                t.equal(doc.bar, 'barz', 'bar is barz')
              })
          })
      })

      s.test('document update with higher rev pos', t => {
        return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
          .then(([{ rev }]) => {
            return db.bulkDocs([{ _id: 'foo', bar: 'barz', _rev: '2-000' }], { new_edits: false })
              .then(() => db.allDocs())
              .then(([doc]) => {
                t.equal(doc._rev, '2-000', 'has correct rev')
                t.equal(doc.bar, 'barz', 'bar is barz')
              })
          })
      })

      s.end()
    })

    g.test('conflicts', s => {
      s.test('choose correct winning ref', t => {
        return db.bulkDocs([{ _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 1, _rev: '1-abc' }], { new_edits: false })
          .then(() => db.allDocs())
          .then(([doc]) => {
            t.equal(doc._rev, '1-def', 'correct winning rev is choosen')
          })
      })

      s.test('simple conflict', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }], { new_edits: false })
          .then(() => db.allDocs({ conflicts: true }))
          .then(response => {
            return response.shift()
          })
          .then(doc => {
            // console.log(JSON.stringify(doc))
            // {
            //   "_id": "foo",
            //   "_rev": "1-def",
            //   "n": 2,
            //   "_conflicts": [
            //     "1-abc"
            //   ]
            // }

            t.ok(Array.isArray(doc._conflicts), '_conflicts is an array')
            t.equal(doc._conflicts.length, 1, '_conflicts contain single entry')
            return doc._conflicts.pop()
          })
          .then(rev => {
            t.equal(rev, '1-abc', 'correct rev is set as conflict')
          })
      })

      s.test('two conflicting revisions', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false })
          .then(() => db.allDocs({ conflicts: true }))
          .then(([doc]) => {
            t.ok(Array.isArray(doc._conflicts), '_conflicts is an array')
            t.equal(doc._conflicts.length, 2, '_conflicts contain single entry')
            return doc._conflicts
          })
          .then(revs => {
            t.ok(revs.indexOf('1-def') !== -1, 'includes first rev')
            t.ok(revs.indexOf('1-abc') !== -1, 'includes second rev')
          })
      })

      s.test('two conflicting revisions, then update winning rev', t => {
        return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false })
          .then(() => db.bulkDocs([{ _id: 'foo', n: 4, _rev: '1-ghi' }]))
          .then(() => db.allDocs({ conflicts: true }))
          .then(([doc]) => {
            t.ok(Array.isArray(doc._conflicts), '_conflicts is an array')
            t.equal(doc._conflicts.length, 2, '_conflicts contain single entry')
            return doc._conflicts
          })
          .then(revs => {
            t.ok(revs.indexOf('1-def') !== -1, 'includes first rev')
            t.ok(revs.indexOf('1-abc') !== -1, 'includes second rev')
          })
      })

      s.end()
    })

    g.test('bulkGet with single rev doc', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(() => db.bulkGet([{ id: 'foo' }]))
        .then(response => {
          t.ok(Array.isArray(response), 'is an array')
          t.equal(response.length, 1, 'has single element')
          return response.shift()
        })
        .then(element => {
          // console.log(JSON.stringify(element))
          // {
          //   "id": "foo",
          //   "docs": [
          //     {
          //       "ok": {
          //         "_id": "foo",
          //         "_rev": "1-c86e975fffb4a635eed6d1dfc92afded",
          //         "bar": "baz"
          //       }
          //     }
          //   ]
          // }

          t.equal(element.id, 'foo', 'id is correct')
          
          t.ok(Array.isArray(element.docs), 'is an array')
          t.equal(element.docs.length, 1, 'has single element')
          return element.docs.shift()
        })
        .then(ok => {
          t.type(ok.ok, 'object', 'ok is an object')
          return ok.ok
        })
        .then(doc => {
          t.equal(doc._id, 'foo', '_id is correct')
          t.equal(doc.bar, 'baz', 'bar is baz')
        })
    })

    g.test('bulkGet with revs:true', t => {
      return db.bulkDocs([{ _id: 'foo', bar: 'baz' }])
        .then(([{ rev }]) => db.bulkDocs([{ _id: 'foo', _rev: rev, bar: 'baz', banane: true }]))
        .then(() => db.bulkGet([{ id: 'foo' }], { revs: true }))
        .then(([{ docs: [{ ok: { _revisions } }] }]) => {
          // console.log(JSON.stringify(_revisions))
          // {
          //   "start": 2,
          //   "ids": [
          //     "3f633dc1f98f2355608ace4dba35aac4",
          //     "b3cec23b98d5f20d20a8279878ddce3d"
          //   ]
          // }
          
          // console.log(JSON.stringify(db._store))

          t.type(_revisions, 'object', '_revisions is an object')
          t.equal(_revisions.start, 2, 'start is correct')
          t.ok(Array.isArray(_revisions.ids), 'ids is an array')
          t.equal(_revisions.ids.length, 2, 'ids contains single entry')
          t.match(_revisions.ids[0], /^[a-f0-9]{32}$/, 'first id look like a rev')
          t.match(_revisions.ids[1], /^[a-f0-9]{32}$/, 'second id look like a rev')
        })
    })

    g.end()
  })
})
