exports.reader = db => options => {
  const state = {
    endReached: false,
    buffer: []
  }

  const setState = cb => {
    db.read(options, (error, docs) => {
      if (error) return cb(error)

      state.buffer = state.buffer.concat(docs)
      state.endReached = true

      cb(null, null)
    })
  }

  return (end, cb) => {
    if (end) return cb(end)

    // close source if everything is emitted
    if (!state.buffer.length && state.endReached) return cb(true)

    // fetch new events if the buffer is empty
    // NOTICE: stream consumer has to make sure that `cb` was called
    //         at least once before requesting another item from the stream
    //         (pull-stream policy)
    if (!state.buffer.length) return setState(cb)

    // emit another element
    cb(null, state.buffer.shift())
  }
}

exports.writer = db => options => {
  return read => {
    return (end, cb) => {
      read(end, (end, docs) => {
        if (end) return cb(end, null)
        if (!docs) return cb(null, null)

        db.write(docs, options, (error, docs) => {
          if (error) return cb(null, error)
          if (!docs) return cb(null, null)

          docs.forEach(doc => cb(null, doc))
        })
      })
    }
  }
}
