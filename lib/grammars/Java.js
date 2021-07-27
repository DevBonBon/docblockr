const DocsParser = require('../docsparser');
const xregexp = require('xregexp');
const escape = require('../utils').escape;

module.exports = class JavaParser extends DocsParser {
  static settings = {
    commentType: 'block',
    curlyTypes: false,
    typeInfo: false,
    typeTag: 'type',
    varIdentifier: '[a-zA-Z_$][a-zA-Z_$0-9]*',
    fnIdentifier: '[a-zA-Z_$][a-zA-Z_$0-9]*',
    fnOpener: '[a-zA-Z_$][a-zA-Z_$0-9]*(?:\\s+[a-zA-Z_$][a-zA-Z_$0-9]*)?\\s*\\(',
    commentCloser: ' */',
    bool: 'Boolean',
    function: 'Function'
  };

  static parseFunction (line) {
    line = line.trim();
    const regex = xregexp(
      // Modifiers
      '(?:(public|protected|private|static|abstract|final|transient|synchronized|native|strictfp)\\s+)*' +
          // Return value
          '(?:(?P<retval>[a-zA-Z_$][\\<\\>\\., a-zA-Z_$0-9\\[\\]]+)\\s+)?' +
          // Method name
          '(?P<name>' + this.settings.fnIdentifier + ')\\s*' +
          // Params
          '\\((?P<args>.*?)\\)\\s*' +
          // # Throws ,
          '(?:throws\\s*(?P<throwed>[a-zA-Z_$0-9\\.,\\s]*))?'
    );

    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    const name = matches.name || '';
    const retval = matches.retval || null;

    let argThrows;
    if (matches.throwed) {
      argThrows = matches.throwed.trim().split(/\s*,\s*/);
    } else {
      argThrows = null;
    }

    let args;
    if (matches.args) {
      args = matches.args.trim();
    } else {
      args = null;
    }

    return [name, args, retval, argThrows];
  }

  static getArgName (arg) {
    if (typeof arg === 'string') {
      arg = arg.trim();
      const splited = arg.split(/\s/);
      return splited[splited.length - 1];
    }
    return arg;
  }

  static parseVar (line) {
    return null;
  }

  static guessTypeFromValue (val) {
    return null;
  }

  static formatFunction (name, args, retval, throwsArgs, options) {
    if (typeof options === 'undefined') {
      options = {};
    }

    const out = super.formatFunction(name, args, retval, options);

    if (throwsArgs) {
      throwsArgs.forEach(type => out.push(`@throws ${escape(type)} \${1:[description]}`));
    }

    return out;
  }

  static getFunctionReturnType (name, retval) {
    if (retval === 'void') { return null; } else { return retval; }
  }

  static getDefinition (editor, point) {
    let maxLines = 25; // don't go further than this

    let definition = '';
    let openCurlyAnnotation = false;
    let openParenAnnotation = false;

    while (maxLines-- > 0 && editor.getBuffer().getLastRow() >= point.row) {
      let line = editor.lineTextForBufferRow(point.row);
      point.row += 1;
      // Move past empty lines
      if (line.search(/^\s*$/) > -1) { continue; }

      // strip comments
      line = line.replace(/\/\/.*/, '');
      line = line.replace(/\/\*.*\*\//, '');
      if (definition === '') {
        if (line.search(/^\s*@/) > -1) {
          // Handle Annotations
          if ((line.search('{') > -1) && line.search('}') === -1) { openCurlyAnnotation = true; }
          if ((line.search('\\(') > -1) && line.search('\\)') === -1) { openParenAnnotation = true; }
          continue;
        } else if (openCurlyAnnotation) {
          if (line.search('}') > -1) { openCurlyAnnotation = false; }
          continue;
        } else if (openParenAnnotation) {
          if (line.search('\\)') > -1) { openParenAnnotation = false; }
        } else if (line.search(/^\s*$/) > -1) {
          continue;
        } else if (!(this.settings.fnOpener) || line.search(RegExp(this.settings.fnOpener)) === -1) {
          // Check for function
          definition = line;
          break;
        }
      }
      definition += line;
      if ((line.indexOf(';') > -1) || (line.indexOf('{') > -1)) {
        const regex = /\s*[;{]\s*$/g;
        definition = definition.replace(regex, '');
        break;
      }
    }
    return definition;
  }
};
