const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

const { config } = require('../utils');

// Try to cut down on code line length
const nameToken = '[a-zA-Z_$\\x7f-\\xff][a-zA-Z0-9_$\\x7f-\\xff]*';

module.exports = class PhpParser extends DocsParser {
  static settings = {
    commentType: 'block',
    // curly brackets around the type information
    curlyTypes: false,
    typeInfo: true,
    typeTag: 'var',
    varIdentifier: nameToken + '(?:->' + nameToken + ')*',
    fnIdentifier: nameToken,
    classIdentifier: nameToken,
    fnOpener: 'function(?:\\s+' + nameToken + ')?\\s*\\(',
    commentCloser: ' */',
    bool: config.get('short_primitives') ? 'bool' : 'boolean',
    function: 'function'
  };

  static parseClass (line) {
    const regex = xregexp(
      '^\\s*class\\s+' +
          '(?P<name>' + this.settings.classIdentifier + ')'
    );

    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    return [matches.name];
  }

  static parseFunction (line) {
    const r = '^\\s*(?:(?P<modifier>(?:(?:final\\s+)?(?:public|protected|private)\\s+)?(?:final\\s+)?(?:static\\s+)?))?' +
              'function\\s+&?(?:\\s+)?' +
              '(?P<name>' + this.settings.fnIdentifier + ')' +
              // function fnName
              // (arg1, arg2)
              '\\s*\\(\\s*(?P<args>.*?)\\)' +
              '(?:\\s*\\:\\s*(?P<retval>[a-zA-Z0-9_\\x5c]*))?';
    const regex = xregexp(r);

    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    return [matches.name, (matches.args ? matches.args.trim() : null), (matches.retval ? matches.retval.trim() : null)];
  }

  static getArgType (arg) {
    // function add($x, $y = 1)
    const regex = xregexp(
      '(?P<name>' + this.settings.varIdentifier + ')\\s*=\\s*(?P<val>.*)'
    );

    let matches = xregexp.exec(arg, regex);
    if (matches !== null) { return this.guessTypeFromValue(matches.val); }

    // function sum(Array $x)
    if (arg.search(/\S\s/) > -1) {
      matches = /^(\S+)/.exec(arg);
      return matches[1];
    } else { return null; }
  }

  static getArgName (arg) {
    const regex = new RegExp(
      '(' + this.settings.varIdentifier + ')(?:\\s*=.*)?$'
    );
    const matches = regex.exec(arg);
    return matches[1];
  }

  static parseVar (line) {
    /*
          var $foo = blah,
              $foo = blah;
          $baz->foo = blah;
          $baz = array(
               'foo' => blah
          )
      */
    const r = '^\\s*(?:(?P<modifier>var|static|const|(?:final)(?:public|private|protected)(?:\\s+final)(?:\\s+static)?)\\s+)?' +
              '(?P<name>' + this.settings.varIdentifier + ')' +
              '(?:\\s*=>?\\s*(?P<val>.*?)(?:[;,]|$))?';
    const regex = xregexp(r);
    const matches = xregexp.exec(line, regex);
    if (matches !== null) { return [matches.name, (matches.val ? matches.val.trim() : null)]; }

    return null;
  }

  static guessTypeFromValue (val) {
    const shortPrimitives = config.get('short_primitives');
    if (this.isNumeric(val)) {
      if (val.indexOf('.') > -1) { return 'float'; }

      return (shortPrimitives ? 'int' : 'integer');
    }
    if ((val[0] === '"') || (val[0] === '\'')) { return 'string'; }
    if (val.slice(0, 5) === 'array' || val[0] === '[') { return 'array'; }

    const values = ['true', 'false', 'filenotfound'];
    if (values.indexOf(val.toLowerCase()) !== -1) {
      return (shortPrimitives ? 'bool' : 'boolean');
    }

    if (val.slice(0, 4) === 'new ') {
      const regex = new RegExp(
        'new (' + this.settings.fnIdentifier + ')'
      );
      const matches = regex.exec(val);
      return (matches[0] && matches[1]) || null;
    }
    return null;
  }

  static getFunctionReturnType (name, retval) {
    const shortPrimitives = config.get('short_primitives');
    if (name.slice(0, 2) === '__') {
      const values = ['__construct', '__destruct', '__set', '__unset', '__wakeup'];
      for (let i = 0; i < values.length; i++) {
        if (name === values[i]) { return null; }
      }
      if (name === '__sleep') { return 'array'; }
      if (name === '__toString') { return 'string'; }
      if (name === '__isset') { return (shortPrimitives ? 'bool' : 'boolean'); }
    } else if (retval === 'void') {
      return null;
    } else if (retval) {
      return retval;
    }
    return super.getFunctionReturnType(name, retval);
  }

  static getDefinition (editor, point) {
    let maxLines = 25;

    let definition = '';

    while (maxLines-- > 0 && editor.getBuffer().getLastRow() >= point.row) {
      let line = editor.lineTextForBufferRow(point.row);
      point.row += 1;

      // null, undefined or invaild
      if (typeof line !== 'string') {
        break;
      }

      line = line
      // strip one line comments
        .replace(/\/\/.*$/g, '')
      // strip block comments
        .replace(/\/\*.*?\*\//g, '');
      // // strip strings
      // .replace(/'(?:\\.|[^'])*'/g, '\'\'')
      // .replace(/"(?:\\.|[^"])*"/g, '""')
      // // strip leading whitespace
      // .replace(/^\s+/, '');

      definition += line;
    }

    return definition;
  }
};
