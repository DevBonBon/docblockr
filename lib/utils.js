const config = {
  // Adds docblockr as the default key path if there's no period before the key
  keypath: key => `${key}`.replace(/^(?!.*\.)/, 'docblockr.'),
  get: (key, options = {}) => atom.config.get(config.keypath(key), options),
  set: (key, value, options = {}) => atom.config.set(config.keypath(key), value, options)
};

module.exports = {
  // This does nothing?
  escape: str => ('' + str).replace('$', '$').replace('{', '{').replace('}', '}'),
  config
};
