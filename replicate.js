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

// auch denkbar:
//
// const replicate = (source, target, options = { since: 0 }) => {
//   return pull(
//     // get to know which docs to replicate
//     source.viewer({ since }),
//
//     // get docs from source
//     source.reader({ revs: true }),
//
//     // write docs to target
//     target.writer({ new_edits: false })
//   )
// }
