const crypto = require('crypto')
const md5 = string => crypto.createHash('md5').update(string, 'binary').digest('hex')

// Memory P
//
// This is an example this._store object:
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

// Get a document by id from store.
// Options can be
// * `revs`: include `_revisions` object
// * `conflicts`: include `_conflicts` array
const fromStore = (store, _id, { revs, conflicts }) => {
  // get winning rev for doc
  const rev = store.ids[_id].head

  // get the document body
  const body = store.revs[rev].body

  // if `options.conflicts` and there are conflicts, get conflicts from branches
  // lookup full revisions (including revision position)
  const _conflicts = conflicts && store.ids[_id].branches ? store.ids[_id].branches.map(rev => store.revs[rev].body._rev) : null

  // if `options.revs`, return a revisions object including start and revision tree
  const _revisions = revs ? { start: parseInt(body._rev, 10), ids: getRevTree(store, rev) } : null

  return {
    ...body,
    _conflicts,
    _revisions
  }
}

// Mutate `store`, insert document
// Options can be
// * `new_edits`: if set to `false` do not generate new rev
const intoStore = (store, { new_edits }) => {
  return doc => {
    // we need a doc id, otherwise we throw.
    // in the future, we can generate an id if none is set.
    if (typeof doc._id !== 'string') throw(new Error('No _id given'))

    // setup id object
    store.ids[doc._id] = store.ids[doc._id] || {}
    
    // get existing rev from store
    const existingRevId = store.ids[doc._id].head
    // get existing rev tree from store
    const existingRevTree = existingRevId ? getRevTree(store, existingRevId) : []
    // rev pos of existing rev is length of tree
    const existingRevPos = existingRevTree.length

    // parse given document revision into position and id
    const [givenRevPos, givenRevId] = doc._rev ? doc._rev.split('-') : []

    // ensure revision matches
    if (new_edits !== false && existingRevId && existingRevId !== givenRevId) {
      return {
        id: doc._id,
        error: 'conflict',
        reason: 'Document update conflict.'
      }
    }

    // enforce presence of revision on new_edits:false
    if (new_edits === false && !givenRevId) throw(new Error('no _rev given'))
    
    // new rev id will be the given one in case of new_edits:false
    // otherwise generate a rev id
    const newRevId = new_edits === false ? givenRevId : generateRevId(doc)
    
    // new rev position will be given rev pos when new_edits:false
    // otherwise, increse the given one (must be same as existing one)
    const newRevPos = new_edits === false ? givenRevPos : calculateRevPos(givenRevPos)

    // store head and branches
    if (new_edits === false) {
      // choose winning revision based on pos and id
      store.ids[doc._id].head = newRevPos > existingRevPos ? newRevId : winningRevId(newRevId, existingRevId)

      store.ids[doc._id].branches = store.ids[doc._id].branches || []

      // do we need to update a branch?
      if (existingRevId && existingRevId !== store.ids[doc._id].head) {
        // if we won, store the existing rev as branch
        store.ids[doc._id].branches.push(existingRevId)
      }
      if (newRevId !== store.ids[doc._id].head) {
        // if old rev won, store new rev as branch
        store.ids[doc._id].branches.push(newRevId)
      }
    } else {
      // on new edits, always update head
      store.ids[doc._id].head = newRevId
    }

    // calculate new rev
    doc._rev = `${newRevPos}-${newRevId}`

    // store the revision
    store.revs[newRevId] = store.revs[newRevId] || {}
    store.revs[newRevId].body = doc
    
    // link parent revision
    if (new_edits !== false) {
      store.revs[newRevId].parent = givenRevId
    }

    // return value with ok, id and new revision
    return {
      ok: true,
      id: doc._id,
      rev: doc._rev
    }
  }
}

// walk up the parents and build array of ancestor rev ids
const getRevTree = (store, rev) => rev in store.revs && store.revs[rev].parent ? [rev].concat(getRevTree(store, store.revs[rev].parent)) : [rev]

// calculate winning rev id based on alphabetical order
const winningRevId = (a, b) => a < b ? b : a

// generate revision id, that is a checksum over doc
const generateRevId = doc => md5(JSON.stringify(doc))

// if given rev position, increment it. Otherwise return 1
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
