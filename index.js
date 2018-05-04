const crypto = require('crypto')
const md5 = string => crypto.createHash('md5').update(string, 'binary').digest('hex')

const fromStore = ({ revs }) => {
  return doc => {
    const d = {
      ...doc.revMap[doc.winningRev],
      _rev: doc.winningRev
    }

    if (revs && Object.keys(doc.revMap).length > 1) {
      d._revisions = getRevisions(doc)
    }

    return d
  }
}

const intoStore = ({ new_edits }) => {
  return (store, doc) => {
    store[doc._id] = store[doc._id] || {}
    store[doc._id]._id = doc._id

    store[doc._id].revMap = store[doc._id].revMap || {}
    
    const rev = new_edits === false ? doc._rev : generateRev(store[doc._id].winningRev, doc)

    store[doc._id].revMap[rev] = doc
    
    store[doc._id].winningRev = calculateWinningRev(store[doc._id].revMap)

    return store
  }
}

const getRevisions = doc => {
  return Object.keys(doc.revMap)
    .sort(byRevision)
    .reduce((memo, rev) => {
      if (rev !== doc.winningRev) {
        memo.ids.push(rev.replace(/^\d+-/, ''))
      }

      return memo
    }, {
      start: parseInt(doc.winningRev, 10),
      ids: []
    })
}

const generateRev = (lastWinningRev, doc) => (lastWinningRev ? parseInt(lastWinningRev, 10) + 1 : 1) + '-' + md5(JSON.stringify(doc))

const calculateWinningRev = (revMap = {}) => {
  const sortedRevs = Object.keys(revMap).sort(byRevision)
  
  return sortedRevs[sortedRevs.length - 1]
}

const byRevision = (a,b) => {
  const na = parseInt(a, 10)
  const nb = parseInt(b, 10)
  
  if (na === nb) {
    return a.replace(/^\d+-/,'') > b.replace(/^\d+-/,'')
  }
  
  return na > nb
}

module.exports = class MiniP {
  constructor () {
    this._store = {}
  }
  
  bulkDocs (docs = [], options = {}) {
    this._store = docs.reduce(intoStore(options), this._store)

    const response = docs.map(doc => ({ ok: true, id: doc._id, rev: this._store[doc._id].winningRev }))

    return Promise.resolve(response)
  }

  allDocs (options = {}) {
    const response = Object.values(this._store).map(fromStore(options))

    return Promise.resolve(response)
  }
}
