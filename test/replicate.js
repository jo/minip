const { test } = require('tap')
const request = require('request-promise-native')

const P = require('..')
const { pull, push } = require('../replicate')

const db = new P()

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

test('drop database', t => request.delete(url).then(() => request.put(url)))

test('ensure clean remote state', t => {
  return request.get({
      url: `${url}/_all_docs`,
      json: true
    })
    .then(({ rows }) => {
      t.equal(rows.length, 0, 'has no elements')
    })
})


test('seed database', t => db.bulkDocs([{ _id: 'foo' }]))

test('push', t => {
  return push(db, url) 
    .then(response => {
      t.type(response, 'object', 'is an object')
      
      return request.get({
          url: `${url}/_all_docs`,
          json: true
        })
        .then(({ rows }) => {
          t.equal(rows.length, 1, 'has one element')
          t.equal(rows[0].id, 'foo', 'has correct element')
        })
    })
})

test('pull', t => {
  return pull(db, url)
    .then(response => {
      t.type(response, 'object', 'response is an object')

      return db.allDocs()
        .then(response => {
          t.equal(response.length, 1, 'response has one element')
          t.equal(response[0]._id, 'foo', 'response has correct element')
        })
    })
})

test('edit item and push again', t => {
  return db.bulkDocs([{ _id: 'bar', n: 1 }])
    .then(([{ rev }]) => {
      const rev1 = rev

      return db.bulkDocs([{ _id: 'bar', n: 2 }])
        .then(([{ rev }]) => {
          const rev2 = rev

          return push(db, url) 
            .then(response => {
              t.type(response, 'object', 'is an object')
              
              return request.get({
                  url: `${url}/bar`,
                  json: true,
                  qs: {
                    revs: true,
                    conflicts: true
                  }
                })
                .then(doc => {
                  t.equal(doc._id, 'bar', 'has correct id')
                  t.same(doc._revisions, {
                    start: 2,
                    ids: [rev1.replace(/^\d+-/, '')]
                  }, 'has correct revisions tree')
                  t.notOk(doc._conflicts, 'has no conflicts')
                })
            })
        })
    })
})
