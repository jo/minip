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

    g.test('allDocs response contains single doc', t => {
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

    g.test('choose correct winning ref', t => {
      return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }], { new_edits: false })
        .then(() => db.allDocs())
        .then(([doc]) => {
          t.equal(doc._rev, '1-def', 'correct winning rev is choosen')
        })
    })

    g.test('allDocs includes conflict', t => {
      return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }], { new_edits: false })
        .then(() => db.allDocs({ conflicts: true }))
        .then(response => {
          return response.shift()
        })
        .then(doc => {
          t.ok(Array.isArray(doc._conflicts), '_conflicts is an array')
          t.equal(doc._conflicts.length, 1, '_conflicts contain single entry')
          return doc._conflicts.pop()
        })
        .then(rev => {
          t.equal(rev, '1-abc', 'correct rev is set as conflict')
        })
    })

    g.test('allDocs with two conflicts', t => {
      return db.bulkDocs([{ _id: 'foo', n: 1, _rev: '1-abc' }, { _id: 'foo', n: 2, _rev: '1-def' }, { _id: 'foo', n: 3, _rev: '1-ghi' }], { new_edits: false })
        .then(() => db.allDocs({ conflicts: true }))
        .then(response => {
          // if (db._store) console.log(JSON.stringify(db._store))
          // {
          //   "foo": {
          //     "_id": "foo",
          //     "revMap": {
          //       "1-abc": {
          //         "_id": "foo",
          //         "n": 1,
          //         "_rev": "1-abc"
          //       },
          //       "1-def": {
          //         "_id": "foo",
          //         "n": 2,
          //         "_rev": "1-def"
          //       },
          //       "1-ghi": {
          //         "_id": "foo",
          //         "n": 3,
          //         "_rev": "1-ghi"
          //       }
          //     },
          //     "winningRev": "1-ghi"
          //   }
          // }

          return response.shift()
        })
        .then(doc => {
          t.ok(Array.isArray(doc._conflicts), '_conflicts is an array')
          t.equal(doc._conflicts.length, 2, '_conflicts contain single entry')
          return doc._conflicts
        })
        .then(revs => {
          t.ok(revs.indexOf('1-def') !== -1, 'includes first rev')
          t.ok(revs.indexOf('1-abc') !== -1, 'includes second rev')
        })
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
        .then(() => db.bulkGet([{ id: 'foo' }], { revs: true }))
        .then(([{ docs: [{ ok: { _revisions } }] }]) => {
          t.type(_revisions, 'object', '_revisions is an object')
          t.equal(_revisions.start, 1, 'start is correct')
          t.ok(Array.isArray(_revisions.ids), 'ids is an array')
          t.equal(_revisions.ids.length, 1, 'ids contains single entry')
          t.match(_revisions.ids[0], /^[a-f0-9]{32}$/, 'id look like a rev')
        })
    })

    g.end()
  })
})
