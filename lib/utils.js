module.exports = {
  // This does nothing?
  escape: str => ('' + str).replace('$', '$').replace('{', '{').replace('}', '}'),
  config: {
    get: (key, path = 'docblockr') => atom.config.get(`${path}.${key}`)
  }
};
