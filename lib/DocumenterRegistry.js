const { config } = require('./utils');

class DocumenterRegistry extends Map {
  static baseDocumenter = {
    comment: {
      start: '/',
      key: '*',
      blockClose: '*/',
      inline: ['//'],
      block: ['/*', '*/'],
      docblock: ['/**', '*/']
    }
  }

  add (filepath) {
    const documenter = Object.assign({}, DocumenterRegistry.baseDocumenter, require(filepath));
    for (const scope of documenter.scopes) {
      super.set(scope, documenter);
    }
  }

  get (scope) {
    const documenter = super.get(scope);
    if (!documenter && config.get('notifications', { scope: [scope] })) {
      atom.notifications.addWarning('Docblockr: Missing matching Documenter.', {
        description: 'The selected Grammar does not currently support advanced features.',
        dismissable: true
      });
      config.set('notifications', false, { scopeSelector: scope });
      return DocumenterRegistry.baseDocumenter;
    }
    return documenter;
  }


}

module.exports = DocumenterRegistry;
