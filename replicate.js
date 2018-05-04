const request = require('request-promise-native')

exports.push = (db, url) => {
  return db.allDocs({ revs: true })
    .then(docs => {
      return request.post({
          url: `${url}/_bulk_docs`,
          json: true,
          body: {
            docs: docs,
            new_edits: false
          }
        })
    })
}

exports.pull = (db, url) => {
  return request.get({
      url: `${url}/_changes`,
      json: true,
      qs: { include_docs: true }
    })
    .then(body => {
      const docs = body.results.map(change => change.doc)

      return db.bulkDocs(docs, { new_edits: false })
    })
}
