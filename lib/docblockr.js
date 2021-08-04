const DocblockrWorker = require('./docblockr-worker.js');

module.exports = class Docblockr {
  static snippets = DocblockrWorker.snippets;

  static activate = DocblockrWorker.activate;

  static deactivate = DocblockrWorker.deactivate;
};
