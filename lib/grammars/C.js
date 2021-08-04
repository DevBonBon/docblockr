const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

// Try to cut down on code line length
const nameToken = '[a-zA-Z_][a-zA-Z0-9_]*';
const identifier = `(${nameToken})(::${nameToken})?(<${nameToken}>)?`;

module.exports = class CppParser extends DocsParser {
  static settings = {
    commentType: 'block',
    typeInfo: false,
    curlyTypes: false,
    typeTag: 'param',
    commentCloser: ' */',
    fnIdentifier: identifier,
    varIdentifier: '(' + identifier + ')\\s*(?:\\[(?:' + identifier + ')?\\]|\\((?:(?:\\s*,\\s*)?[a-z]+)+\\s*\\))?',
    fnOpener: identifier + '\\s+' + identifier + '\\s*\\(',
    bool: 'bool',
    function: 'function'
  };

  static parseFunction (line) {
    const regex = xregexp(
      '((?P<retval>' + this.settings.varIdentifier + ')[&*\\s]+)?' +
          '(?P<name>' + this.settings.varIdentifier + ');?' +
          // void fnName
          // (arg1, arg2)
          '\\s*\\(\\s*(?P<args>.*?)\\)'
    );
    const matches = xregexp.exec(line, regex);

    if (matches === null) {
      return null;
    }

    const args = matches.args || null;
    const retval = matches.retval || null;

    return [matches.name, args, retval];
  }

  static parseArgs (args) {
    if (args.trim() === 'void') { return []; }
    return super.parseArgs(args);
  }

  static getArgType (arg) {
    if (arg === '...') {
      // variable arguments
      return 'VARARGS';
    }
    const regex = new RegExp('(' + this.settings.varIdentifier + '[&*\\s]+)');
    const arrayRegex = /[^[]+\s*(\[\])?/;
    const matches = regex.exec(arg) || [];
    const arrayMatches = arrayRegex.exec(arg) || [];
    const result = (matches[1] || '[type]').replace(/\s+/g, '');
    const arrayResult = (arrayMatches[1] || '').replace(/\s+/g, '');
    return result + arrayResult;
  }

  static getArgName (arg) {
    if (arg === '...') {
      // variable arguments
      return 'VARARGS';
    }
    const regex = new RegExp(this.settings.varIdentifier + '(?:\\s*=.*)?$');
    const matches = regex.exec(arg) || [];
    return matches[1] || '[name]';
  }

  static parseVar (line) {
    return null;
  }

  static guessTypeFromValue (val) {
    return null;
  }

  static getFunctionReturnType (name, retval) {
    return ((retval !== 'void') ? retval : null);
  }
};