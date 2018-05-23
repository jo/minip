const request = require('request')

module.exports = class HttpP {
  constructor (url) {
    this.url = url
  }

  reset (done) {
    request.delete(this.url, () => {
      request.put(this.url, () => done(null))
    })
  }

  // get document ids
  read (options = {}, done) {
    if (typeof options === 'function') {
      done = options
      options = {}
    }

    return options.revs ? this._readDocsWithRevs(options, done) : this._readDocs(options, done)
  }

  _readDocsWithRevs (options = {}, done) {
    const qs = {}

    if (options.conflicts) {
      qs.include_docs = true
      qs.conflicts = true
    }

    return request.get({
      url: `${this.url}/_all_docs`,
      json: true,
      qs
    }, (error, response, body) => {
      if (error) return done(error)

      const docs = body.rows.map(row => ({ id: row.id, rev: row.value.rev }))

      const conflicts = options.conflicts && body.rows.reduce((memo, row) => {
        memo[row.id] = row.doc._conflicts
        return memo
      }, {})

      request.post({
        url: `${this.url}/_bulk_get`,
        json: true,
        body: {
          docs
        },
        qs: {
          revs: true
        }
      }, (error, response, body) => {
        if (error) return done(error)

        const docs = body.results.reduce((memo, { docs }) => memo.concat(docs.map(doc => doc.ok)), [])

        if (options.conflicts) {
          docs.forEach(doc => {
            doc._conflicts = conflicts[doc._id]
          })
        }

        done(null, docs)
      })
    })
  }

  _readDocs (options = {}, done) {
    const qs = {
      include_docs: true
    }

    if (options.conflicts) qs.conflicts = true

    return request.get({
      url: `${this.url}/_all_docs`,
      json: true,
      qs
    }, (error, response, body) => {
      if (error) return done(error)

      const ids = body.rows.map(row => row.doc)

      done(null, ids)
    })
  }

  // write documents
  //
  // options can be
  // * new_edits: if set to false, do not generate new revisions, use provided rev
  write (docs, options = {}, done) {
    if (typeof options === 'function') {
      done = options
      options = {}
    }

    if (!Array.isArray(docs)) docs = [docs]

    const body = { docs }

    if (options.new_edits === false) {
      if (docs.find(doc => !doc._rev)) throw (new Error('no _rev given'))
      body.new_edits = false
    }

    const callback = done
      ? (error, response, body) => done(error, body.length ? body : null)
      : null

    return request.post({
      url: `${this.url}/_bulk_docs`,
      json: true,
      body
    }, callback)
  }
}
