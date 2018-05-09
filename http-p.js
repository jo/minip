const request = require('request-promise-native')

module.exports = class HttpP {
  constructor (url) {
    this.url = url
  }

  destroy () {
    return request.delete({
      url: `${this.url}`
    })
  }
  
  create () {
    return request.put({
      url: `${this.url}`
    })
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
    return request.get({
        url: `${this.url}/_all_docs`,
        json: true,
        qs: {
          include_docs: true,
          conflicts: options.conflicts
        }
      })
      .then(body => body.rows.map(row => row.doc))
  }

  // [{"id":"foo","docs":[{"ok":{"_id":"foo","_rev":"1-c86e975fffb4a635eed6d1dfc92afded","bar":"baz"}}]}]
  bulkGet (docs = [], options = {}) {
    return request.post({
        url: `${this.url}/_bulk_get`,
        json: true,
        body: {
          docs
        },
        qs: {
          revs: options.revs
        }
      })
      .then(body => body.results)
  }
}
