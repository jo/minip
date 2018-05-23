const crypto = require('crypto')
const md5 = string => crypto.createHash('md5').update(string, 'binary').digest('hex')

// Memory P
//
// This is an example `this._store` object:
//
// {
//   ids: {
//     "mydoc": {
//       winner: "ghi",
//       branches: {
//         "def": 2,
//         "ghi": 2
//       }
//     }
//   },
//   revs: {
//     "abc": {
//       body: {
//         foo: 'bar'
//       }
//     },
//     "def": {
//       parent: "abc"
//     },
//     "ghi": {
//       body: {
//         foo: 'qux'
//       },
//       parent: "abc"
//     }
//   }
// }

// Get a document by id from store.
// TODO: support find by rev
// Options can be
// * `revs`: include `_revisions` object
// * `conflicts`: include `_conflicts` array
const fromStore = (store, _id, { revs, conflicts }) => {
  const info = store.ids[_id]
  const revId = info.winner
  const revPos = info.branches[info.winner]
  const _rev = `${revPos}-${revId}`

  // get the document body
  const body = store.revs[revId].body

  const doc = {
    ...body,
    _id,
    _rev
  }

  // get additional information if asked for
  if (revs) doc._revisions = getRevisions(store.revs, info, revId)
  if (conflicts) doc._conflicts = getConflicts(info, revId)

  return doc
}

// return a revisions object including start and revision tree
const getRevisions = (revs, info, revId) => {
  return {
    start: info.branches[revId],
    ids: getRevTree(revs, revId)
  }
}

// if there are conflicts, get conflicts from branches
// and return full revisions (including position)
const getConflicts = (info, rev) => {
  if (typeof info.branches !== 'object') return
  if (Object.keys(info.branches).length <= 1) return

  return Object.keys(info.branches)
    .filter(id => id !== rev)
    .map(rev => `${info.branches[rev]}-${rev}`)
    .reverse()
}

const insertAsNewEdits = store => doc => {
  // we need a doc id, otherwise we throw.
  // in the future, we can generate an id if none is set.
  if (typeof doc._id !== 'string') throw (new Error('No _id given'))

  // get existing rev from store
  const existingRevId = doc._id in store.ids && store.ids[doc._id].winner

  // parse given document revision into position and id
  const [givenRevPos, givenRevId] = parseRevision(doc._rev)

  // ensure revision matches
  if (existingRevId && existingRevId !== givenRevId) {
    return {
      id: doc._id,
      error: 'conflict',
      reason: 'Document update conflict.'
    }
  }

  // strip doc from metadata
  const body = stripMeta(doc)
  // generate new rev
  const newRevId = generateRevId(body, existingRevId)
  const newRevPos = givenRevPos + 1

  // calculate new rev
  doc._rev = `${newRevPos}-${newRevId}`

  // store the revision
  store.revs[newRevId] = {
    body,
    parent: existingRevId
  }

  // store winner
  store.ids[doc._id] = store.ids[doc._id] || { branches: {} }
  store.ids[doc._id].winner = newRevId
  store.ids[doc._id].branches[newRevId] = newRevPos

  // delete previous winner branch
  delete store.ids[doc._id].branches[givenRevId]

  return {
    ok: true,
    id: doc._id,
    rev: doc._rev
  }
}

const insert = store => doc => {
  // we need a doc id, otherwise we throw.
  // in the future, we can generate an id if none is set.
  if (typeof doc._id !== 'string') throw (new Error('No _id given'))

  // parse given document revision into position and id
  const [givenRevPos, givenRevId] = parseRevision(doc._rev)

  // enforce presence of revision
  if (!givenRevId) throw (new Error('no _rev given'))

  // store the revision
  store.revs[givenRevId] = {
    body: doc
  }

  // loop over each node and create a revision if not existent
  if (doc._revisions && doc._revisions.ids.length > 1) {
    var previousRevId
    var currentRevId

    for (var i = 1; i < doc._revisions.ids.length; i++) {
      previousRevId = doc._revisions.ids[i - 1]
      currentRevId = doc._revisions.ids[i]

      store.revs[previousRevId] = store.revs[previousRevId] || {}

      // Possible optimisation:
      // check for a conflict with current parent,
      // see what couch does
      // and maybe throw if parent does not match
      store.revs[previousRevId].parent = currentRevId

      // Another possible optimisation:
      // stop walking the tree if parent is known

      // delete branch
      if (store.ids[doc._id].branches && currentRevId in store.ids[doc._id].branches) {
        delete store.ids[doc._id].branches[currentRevId]
      }
    }
  }

  // get existing rev from store
  const existingRevId = doc._id in store.ids && store.ids[doc._id].winner
  const existingRevPos = (existingRevId && store.ids[doc._id].branches[existingRevId]) || 0

  // store / update branches
  store.ids[doc._id] = store.ids[doc._id] || { branches: {} }
  store.ids[doc._id].branches[givenRevId] = givenRevPos

  // choose winning rev
  const winningRevId = chooseWinningRevId(
    [givenRevPos, givenRevId],
    [existingRevPos, existingRevId]
  )

  // store winner
  store.ids[doc._id].winner = winningRevId

  // return value with ok, id and new revision
  return {
    ok: true,
    id: doc._id,
    rev: doc._rev
  }
}

// Mutate `store`, insert document
// Options can be
// * `new_edits`: if set to `false` do not generate new rev
const intoStore = (store, { new_edits = true }) => {
  return new_edits ? insertAsNewEdits(store) : insert(store)
}

// walk up the parents and build array of ancestor rev ids
const getRevTree = (revs, rev) => rev in revs && revs[rev].parent ? [rev].concat(getRevTree(revs, revs[rev].parent)) : [rev]

// calculate winning rev id based on rev pos and alphabetical order of rev id
const chooseWinningRevId = ([aPos, aId], [bPos, bId]) => {
  if (aPos > bPos) return aId
  if (aPos < bPos) return bId

  return aId > bId ? aId : bId
}

// generate revision id,
// that is a checksum over doc and rev
// without toplevel properties keys starting with `_`
const stripMeta = doc => {
  const payload = {
    ...doc
  }

  Object.keys(payload)
    .filter(key => key[0] === '_')
    .forEach(key => delete payload[key])

  return payload
}

const generateRevId = (doc, _rev) => md5(JSON.stringify({ ...doc, _rev }))

const parseRevision = rev => {
  if (!rev) return [0]

  const [pos, id] = rev.split('-')

  return [
    parseInt(pos, 10) || 0,
    id
  ]
}

module.exports = class MemoryP {
  constructor () {
    this._store = { ids: {}, revs: {} }
  }

  reset (done) {
    this._store = { ids: {}, revs: {} }
    done(null)
  }

  // get documents
  read (options = {}, done) {
    if (typeof options === 'function') {
      done = options
      options = {}
    }

    const response = Object.keys(this._store.ids)
      .sort()
      .map(id => fromStore(this._store, id, options))

    done(null, response)
  }

  // write documents
  //
  // options can be
  // * new_edits: if set to false, do not generate new revisions, use provided rev
  write (docs, options = {}, done) {
    if (typeof options === 'function') {
      done = options
      options = {}
    }

    if (!Array.isArray(docs)) docs = [docs]

    const response = docs.map(intoStore(this._store, options))

    done(null, response)
  }
}
