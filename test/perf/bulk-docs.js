const { test } = require('tap')

const P = require('../../memory-p')

let uuid = 0
const generateDocs = (BATCH_SIZE, generateRevs) => {
  const docs = []
  let doc

  for (let i = 0; i < BATCH_SIZE; i++) {
    doc = { _id: 'foo-' + uuid++ }
    if (generateRevs) doc._rev = '1-abc' + uuid
    docs.push(doc)
  }
  return docs
}

const db = new P()

for (let BATCH_SIZE = 1000; BATCH_SIZE < 10001; BATCH_SIZE=BATCH_SIZE*10) {
  test(`bulkDocs insert in batches á ${BATCH_SIZE}:`, g => {
    let docs
    for (let b = 0; b < 3; b++) {
      docs = generateDocs(BATCH_SIZE)
      g.test(`bulkDocs batch #${b}`, t => {
        return db.bulkDocs(docs)
      })
      g.test(`bulkDocs batch new_edits false #${b}`, t => {
        return db.bulkDocs(docs, { new_edits: false })
      })
    }

    g.end()
  })
}
