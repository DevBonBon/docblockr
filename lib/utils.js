module.exports = {
  config: {
    get: (key, path = 'docblockr') => atom.config.get(`${path}.${key}`)
  }
};
