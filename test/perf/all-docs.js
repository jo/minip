const { test } = require('tap')

const url = process.env.COUCH || 'http://localhost:5984/minip-test'

const Ps = [
  require('../../memory-p'),
  require('../../http-p')
]

let uuid = 0
const generateDocs = BATCH_SIZE => {
  const docs = []
  let doc

  for (let i = 0; i < BATCH_SIZE; i++) {
    doc = { _id: 'foo-' + uuid++ }
    doc._rev = '1-abc' + uuid
    docs.push(doc)
  }
  return docs
}

Ps.forEach(P => {
  test(P.name, g => {
    const db = new P(url)

    g.beforeEach(done => db.reset(done))

    for (let BATCH_SIZE = 1000; BATCH_SIZE < 100001; BATCH_SIZE = BATCH_SIZE * 10) {
      g.test(`allDocs #${BATCH_SIZE}`, t => {
        const docs = generateDocs(BATCH_SIZE)

        db.write(docs, { new_edits: false }, (error) => {
          t.error(error)
          const start = new Date()
          db.read((error) => {
            t.error(error)
            t.pass(`${new Date() - start}ms`)
            t.end()
          })
        })
      })
    }

    g.end()
  })
})
