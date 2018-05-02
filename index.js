const crypto = require('crypto')

const fromStore = doc => {
  return {
    ...doc.revMap[doc.winningRev],
    _rev: doc.winningRev
  }
}

const intoStore = new_edits => {
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

const md5 = string => crypto.createHash('md5').update(string, 'binary').digest('hex')

const generateRev = (lastWinningRev, doc) => (lastWinningRev ? parseInt(lastWinningRev, 10) + 1 : 1) + '-' + md5(JSON.stringify(doc))

const calculateWinningRev = (revMap = {}) => {
  const sortedRevs = Object.keys(revMap).sort()
  
  return sortedRevs[sortedRevs.length - 1]
}

module.exports = class Minipouch {
  constructor () {
    this._docsById = {}
  }
  
  bulkDocs (docs = [], options = {}) {
    this._docsById = docs.reduce(intoStore(options.new_edits), this._docsById)

    const response = docs.map(doc => ({ ok: true, id: doc._id, rev: this._docsById[doc._id].winningRev }))

    return Promise.resolve(response)
  }

  allDocs () {
    const response = Object.values(this._docsById).map(fromStore)

    return Promise.resolve(response)
  }
}
