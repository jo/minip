const crypto = require('crypto')
const md5 = string => crypto.createHash('md5').update(string, 'binary').digest('hex')

// Store
//
// {
//   ids: {
//     "mydoc": {
//       head: "ghi",
//       branches: [
//         "def"
//       ]
//     }
//   },
//   revs: {
//     "abc": {
//       body: {
//         foo: 'bar'
//       }
//     },
//     "def": {
//       body: {
//         foo: 'baz'
//       },
//       parent: "abc"
//     },
//     "ghi": {
//       body: {
//         foo: 'barz'
//       },
//       parent: "abc"
//     }
//   }
// }

const fromStore = (store, _id, { revs, conflicts }) => {
  const rev = store.ids[_id].head

  const body = store.revs[rev].body
  const _conflicts = conflicts && store.ids[_id].branches ? store.ids[_id].branches.map(rev => store.revs[rev].body._rev) : null
  const _revisions = revs ? { start: parseInt(body._rev, 10), ids: getRevTree(store, rev) } : null

  return {
    ...body,
    _conflicts,
    _revisions
  }
}

const intoStore = (store, { new_edits }) => {
  return doc => {
    if (typeof doc._id !== 'string') throw(new Error('No _id given'))

    store.ids[doc._id] = store.ids[doc._id] || {}
    
    const existingRevId = store.ids[doc._id].head
    const existingRevTree = existingRevId ? getRevTree(store, existingRevId) : []
    const existingRevPos = existingRevTree.length

    const [givenRevPos, givenRevId] = doc._rev ? doc._rev.split('-') : []

    if (new_edits !== false && existingRevId && existingRevId !== givenRevId) {
      return {
        id: doc._id,
        error: 'conflict',
        reason: 'Document update conflict.'
      }
    }

    if (new_edits === false && !givenRevId) throw(new Error('no _rev given'))
    
    const newRevId = new_edits === false ? givenRevId : generateRevId(doc)
    const newRevPos = new_edits === false ? givenRevPos : calculateRevPos(givenRevPos)

    if (new_edits === false) {
      store.ids[doc._id].head = newRevPos > existingRevPos ? newRevId : winningRevId(newRevId, existingRevId)
      store.ids[doc._id].branches = store.ids[doc._id].branches || []
      if (existingRevId && existingRevId !== store.ids[doc._id].head) {
        store.ids[doc._id].branches.push(existingRevId)
      }
      if (newRevId !== store.ids[doc._id].head) {
        store.ids[doc._id].branches.push(newRevId)
      }
    } else {
      store.ids[doc._id].head = newRevId
    }

    doc._rev = `${newRevPos}-${newRevId}`

    store.revs[newRevId] = store.revs[newRevId] || {}
    store.revs[newRevId].body = doc
    
    if (new_edits !== false) {
      store.revs[newRevId].parent = givenRevId
    }

    return {
      ok: true,
      id: doc._id,
      rev: doc._rev
    }
  }
}

const getRevTree = (store, rev) => rev in store.revs && store.revs[rev].parent ? [rev].concat(getRevTree(store, store.revs[rev].parent)) : [rev]
const winningRevId = (a, b) => a < b ? b : a
const generateRevId = doc => md5(JSON.stringify(doc))
const calculateRevPos = givenRevPos => givenRevPos ? parseInt(givenRevPos, 10) + 1 : 1

module.exports = class MemoryP {
  constructor () {
    this._store = { ids: {}, revs: {} }
  }

  reset () {
    this._store = { ids: {}, revs: {} }
    return Promise.resolve()
  }
  
  bulkDocs (docs = [], options = {}) {
    const response = docs.map(intoStore(this._store, options))
    
    return Promise.resolve(response)
  }

  allDocs (options = {}) {
    const response = Object.keys(this._store.ids)
      .sort()
      .map(id => fromStore(this._store, id, options))

    return Promise.resolve(response)
  }

  bulkGet (docs = [], options = {}) {
    const response = docs
      .map(doc => fromStore(this._store, doc.id, options))
      .map(doc => {
        return {
          id: doc._id,
          docs: [
            {
              ok: doc
            }
          ]
        }
      })

    return Promise.resolve(response)
  }
}
