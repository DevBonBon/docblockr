module.exports = {
  config: {
    // See 'atom.config.get'
    get: (key, options = {}) =>
      // Appends 'docblockr.' to the keypath, if there's no period in the key
      atom.config.get(`${key.includes('.') ? '' : 'docblockr.'}${key}`, options)
  },
  // This does nothing?
  escape: str => ('' + str).replace('$', '$').replace('{', '{').replace('}', '}')
};
