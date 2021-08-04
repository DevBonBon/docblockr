const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

const { config } = require('../utils');

// Try to cut down on code line length
const identifier = '[a-zA-Z_$][a-zA-Z_$0-9]*';
const baseTypeIdentifier = `${identifier}(\\.${identifier})*(\\[\\])?`;
const parametricTypeIdentifier = `${baseTypeIdentifier}(\\s*<\\s*${baseTypeIdentifier}(\\s*,\\s*${baseTypeIdentifier}\\s*)*>)?`;

module.exports = class TypescriptParser extends DocsParser {
  static settings = {
    commentType: 'block',
    // curly brackets around the type information
    curlyTypes: true,
    typeInfo: false,
    typeTag: 'type',
    // technically, they can contain all sorts of unicode, but w/e
    varIdentifier: identifier,
    fnIdentifier: identifier,
    fnOpener: 'function(?:\\s+' + identifier + ')?\\s*\\(',
    commentCloser: ' */',
    bool: 'Boolean',
    function: 'Function',
    functionRE:
            // Modifiers
            '(?:public|private|static)?\\s*' +
            // Method name
            '(?P<name>' + identifier + ')\\s*' +
            // Params
            '\\((?P<args>.*?)\\)\\s*' +
            // Return value
            '(:\\s*(?P<retval>' + parametricTypeIdentifier + '))?',
    var_re:
            '((public|private|static|var)\\s+)?(?P<name>' + identifier +
            ')\\s*(:\\s*(?P<type>' + parametricTypeIdentifier +
            '))?(\\s*=\\s*(?P<val>.*?))?([;,]|$)'
  };

  static parseFunction (line) {
    line = line.trim();
    const regex = xregexp(this.settings.functionRE);
    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    return [matches.name, matches.args, matches.retval];
  }

  static getArgType (arg) {
    if (arg.indexOf(':') > -1) {
      const argList = arg.split(':');
      return argList[argList.length - 1].trim();
    }
    return null;
  }

  static getArgName (arg) {
    if (arg.indexOf(':') > -1) { arg = arg.split(':')[0]; }

    const pubPrivPattern = /\b(public|private)\s+|/g;
    arg = arg.replace(pubPrivPattern, '');

    const regex = /[ ?]/g;
    return arg.replace(regex, '');
  }

  static parseVar (line) {
    const regex = xregexp(this.settings.var_re);
    const matches = xregexp.exec(line, regex);
    if (matches == null) { return null; }
    let val = matches.val;
    if (val != null) { val = val.trim(); }

    return [matches.name, val, matches.type];
  }

  static getFunctionReturnType (name, retval) {
    if (name === 'constructor') {
      return null;
    }
    return ((retval !== 'void') ? retval : null);
  }

  static guessTypeFromValue (val) {
    const lowerPrimitives = config.get('lower_case_primitives');
    if (this.isNumeric(val)) { return (lowerPrimitives ? 'number' : 'Number'); }
    if ((val[0] === '\'') || (val[0] === '"')) { return (lowerPrimitives ? 'string' : 'String'); }
    if (val[0] === '[') { return 'Array'; }
    if (val[0] === '{') { return 'Object'; }
    if ((val === 'true') || (val === 'false')) { return (lowerPrimitives ? 'boolean' : 'Boolean'); }
    let regex = /RegExp\b|\/[^/]/;
    if (regex.test(val)) {
      return 'RegExp';
    }
    if (val.slice(0, 4) === 'new ') {
      regex = new RegExp(
        'new (' + this.settings.fnIdentifier + ')'
      );
      const matches = regex.exec(val);
      return (matches[0] && matches[1]) || null;
    }
    return null;
  }
};