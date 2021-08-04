const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

module.exports = class ActionscriptParser extends DocsParser {
  static settings = {
    commentType: 'block',
    typeInfo: false,
    curlyTypes: false,
    typeTag: '',
    commentCloser: ' */',
    fnIdentifier: '[a-zA-Z_][a-zA-Z0-9_]*',
    varIdentifier: '([a-zA-Z_][a-zA-Z0-9_]*)(?::[a-zA-Z_][a-zA-Z0-9_]*)?',
    fnOpener: 'function(?:\\s+[gs]et)?(?:\\s+[a-zA-Z_][a-zA-Z0-9_]*)?\\s*\\(',
    bool: 'bool',
    function: 'function'
  };

  static parseFunction (line) {
    let regex = xregexp(
      // fnName = function,  fnName : function
      '(?:(?P<name1>' + this.settings.varIdentifier + ')\\s*[:=]\\s*)?' +
          'function(?:\\s+(?P<getset>[gs]et))?' +
          // function fnName
          '(?:\\s+(?P<name2>' + this.settings.fnIdentifier + '))?' +
          // (arg1, arg2)
          '\\s*\\(\\s*(?P<args>.*?)\\)'
    );
    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    regex = new RegExp(this.settings.varIdentifier, 'g');
    const name = matches.name1 || matches.name2 || '';
    const args = matches.args;
    const options = {};
    if (matches.getset === 'set') { options.asSetter = true; }

    return [name, args, null, options];
  }

  static parseVar (line) {
    return null;
  }

  static getArgName (arg) {
    if (!arg) {
      return arg;
    }
    const regex = new RegExp(this.settings.varIdentifier + '(\\s*=.*)?');
    const match = arg.match(regex);
    if (match && match[1]) {
      return match[1];
    } else {
      return arg;
    }
  }

  static getArgType (arg) {
    // could actually figure it out easily, but it's not important for the documentation
    return null;
  }
};