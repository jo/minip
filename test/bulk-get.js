const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const MemoryP = require('../memory-p')
const HttpP = require('../http-p')

const Ps = [
  MemoryP,
  HttpP
]

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)
  
    g.beforeEach(() => db.reset())

    g.test('returns a promise', t => db.bulkGet())

    g.test('single rev doc', t => {
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

    g.test('revs:true', t => {
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


