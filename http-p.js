const request = require('request')
const requestP = require('request-promise-native')

// Whats the difference between
// ```
// { docs: [{ _id: 'foo', _rev: '1-abc' }] }
// ```
// and
// ```
// { docs: [{ _id: 'foo', _rev: '2-def', _revisions: { start: 2, ids: ['def', 'abc'] }], new_edits: false }
// ```
// ?
//
//
// and: will do
// ```
// { docs: [{ _id: 'foo', _rev: '3-ghi', _revisions: { start: 3, ids: ['ghi', 'def', 'abc'] }], new_edits: false }
// ```
// the same as
// ```
// { docs: [{ _id: 'foo', _rev: '3-ghi', _revisions: { start: 3, ids: ['ghi', 'def'] }], new_edits: false }
// ```
// ?
//
// what happens if I do
// ```
// { docs: [{ _id: 'foo', _rev: '3-ghi', _revisions: { start: 3, ids: ['ghi', 'def', '000'] }], new_edits: false }
// ```
// (wrong _revisions)
// instead of
// ```
// { docs: [{ _id: 'foo', _rev: '3-ghi', _revisions: { start: 3, ids: ['ghi', 'def', 'abc'] }], new_edits: false }
// ```
// ?
//
//

module.exports = class HttpP {
  constructor (url) {
    this.url = url
  }


  // new API

  // get document ids
  //
  // options:
  // * keys
  // * startkey
  // * endkey
  // * limit
  view (options, done) {
    if (typeof options === 'function') {
      done = options
      options = null
    }

    return request.get({
        url: `${this.url}/_all_docs`,
        json: true
      }, (error, response, body) => {
        if (error) return done(error)

        const ids = body.rows.map(row => ({ id: row.id, rev: row.value.rev }))

        done(null, ids)
      })
  }

  // source stream of a view
  viewer (options) {
    const state = {
      endReached: false,
      buffer: []
    }

    const setState = cb => {
      this.view(options, (error, docs) => {
        if (error) return cb(error)

        state.buffer = state.buffer.concat(docs)
        state.endReached = true

        cb(null, null)
      })
    }

    return (end, cb) => {
      if (end) return cb(end)

      // close source if everything is emitted
      if (!state.buffer.length && state.endReached) return cb(true)

      // fetch new events if the buffer is empty
      // NOTICE: stream consumer has to make sure that `cb` was called
      //         at least once before requesting another item from the stream
      //         (pull-stream policy)
      if (!state.buffer.length) return setState(cb)

      // emit another element
      cb(null, state.buffer.shift())
    }
  }

  // get full documents
  //
  // docs can be either
  // * array of id strings
  // * array of objects in the form { id, [rev] }
  //   rev can be either revision string or array of rev strings
  // options can be
  // * revs: include _revisions
  // * conflicts: include _conflicts
  read (docs, options, done) {
    if (typeof options === 'function') {
      done = options
      options = null
    }

    if (!Array.isArray(docs)) docs = [docs]

    const qs = {}

    if (options && 'rev' in options) qs.revs = options.revs

    const body = {
      docs
    }

    return request.post({
        url: `${this.url}/_bulk_get`,
        json: true,
        body,
        qs
      }, (error, response, body) => {
        if (error) return done(error)

        const docs = body.results.reduce((memo, { docs }) => memo.concat(docs.map(doc => doc.ok)), [])

        done(null, docs)
      })
  }

  // reader through
  reader (options) {
    return read => {
      return (end, cb) => {
        read(end, (end, docs) => {
          if (docs === null) return cb(end, null)
          if (end) return cb(end, null)

          this.read(docs, options, (error, docs) => {
            if (error) return cb(null, error)

            docs.forEach(doc => cb(null, doc))
          })
        })
      }
    }
  }

  // write documents
  //
  // options can be
  // * new_edits: if set to false, do not generate new revisions, use provided rev
  write (docs, options = {}, done) {
    if (!Array.isArray(docs)) docs = [docs]

    if (options.new_edits === false) {
      body.new_edits = false
    }

    const callback = done ? (error, response, body) => done(error, body) : null

    return request.post({
        url: `${this.url}/_bulk_docs`,
        json: true,
        body: {
          docs
        }
      }, callback)
  }
  
  // write through stream
  writer (options = { new_edits: true }) {
    return read => {
      return (end, cb) => {
        read(end, (end, docs) => {
          if (docs === null) return cb(end, null)
          if (end) return cb(end, null)

          this.write(docs, options, (error, docs) => {
            if (error) return cb(null, error)

            docs.forEach(doc => cb(null, doc))
          })
        })
      }
    }
  }



  // old API

  reset () {
    return requestP.delete(`${this.url}`)
      .then(() => requestP.put(`${this.url}`))
      .catch(() => true)
  }

  bulkDocs (docs = [], options = {}) {
    const body = { docs }

    if (options.new_edits === false) {
      body.new_edits = false
    }

    return requestP.post({
      url: `${this.url}/_bulk_docs`,
      json: true,
      body
    })
  }

  // [{"_id":"foo","_rev":"1-c86e975fffb4a635eed6d1dfc92afded","bar":"baz"}]
  allDocs (options = {}) {
    const requestOptions = {
      url: `${this.url}/_all_docs`,
      json: true,
      qs: {
        include_docs: true,
        conflicts: options.conflicts
      }
    }

    return requestP.get(requestOptions)
      .then(body => body.rows.map(row => row.doc))
  }

  // [{"id":"foo","docs":[{"ok":{"_id":"foo","_rev":"1-c86e975fffb4a635eed6d1dfc92afded","bar":"baz"}}]}]
  bulkGet (docs = [], options = {}) {
    const requestOptions = {
      url: `${this.url}/_bulk_get`,
      json: true,
      body: {
        docs
      },
      qs: {
        revs: options.revs
      }
    }

    return requestP.post(requestOptions)
      .then(body => body.results)
  }
}
