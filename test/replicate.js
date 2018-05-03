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


test('seed database', t => db.bulkDocs([{ _id:'one' }, { _id:'two' }, { _id:'three' }]))

test('push', t => {
  return push(db, url) 
    .then(response => {
      t.type(response, 'object', 'is an object')
      
      return request.get({
          url: `${url}/_all_docs`,
          json: true
        })
        .then(({ rows }) => {
          t.equal(rows.length, 3, 'has three elements')
        })
    })
})

test('pull', t => {
  return pull(db, url)
    .then(response => {
      t.type(response, 'object', 'response is an object')

      return db.allDocs()
        .then(response => {
          t.equal(response.length, 3, 'response has three elements')
        })
    })
})
