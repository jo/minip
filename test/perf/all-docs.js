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

for (let BATCH_SIZE = 1000; BATCH_SIZE < 100001; BATCH_SIZE=BATCH_SIZE*10) {
  test(`allDocs batch #${BATCH_SIZE}`, t => {
    docs = generateDocs(BATCH_SIZE)

    return db.bulkDocs(docs, { new_edits: false })
      .then(() => {
        return db.allDocs()
          .then(response => t.pass(`got ${response.length} docs`))
      })
  })
}
