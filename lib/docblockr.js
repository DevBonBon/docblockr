var DocblockrWorker = require('./docblockr-worker.js');
var Disposable = require('atom').Disposable;

module.exports = {
  activate: function () {
    return (this.Docblockr = new DocblockrWorker());
  },

  consumeSnippetsService: function (service) {
    this.Docblockr.setSnippetsService(service);
    return new Disposable(() => {
      this.Docblockr.setSnippetsService(null);
    });
  }
};
