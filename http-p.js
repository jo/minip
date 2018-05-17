const request = require('request-promise-native')

module.exports = class HttpP {
  constructor (url) {
    this.url = url
  }

  reset () {
    return request.delete(`${this.url}`)
      .then(() => request.put(`${this.url}`))
      .catch(() => true)
  }

  bulkDocs (docs = [], options = {}) {
    const body = { docs }

    if (options.new_edits === false) {
      body.new_edits = false
    }

    return request.post({
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

    return request.get(requestOptions)
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

    return request.post(requestOptions)
      .then(body => body.results)
  }
}
