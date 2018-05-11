module.exports = (source, target) => {
  return source.allDocs()
    .then(docs => {
      const ids = docs.map(doc => ({ id: doc._id, rev: doc._rev }))

      return source.bulkGet(ids, { revs: true })
    })
    .then(response => {
      const docs = response.reduce((memo, r) => {
        return memo.concat(r.docs.map(d => d.ok))
      }, [])

      return target.bulkDocs(docs, { new_edits: false })
    })
}
