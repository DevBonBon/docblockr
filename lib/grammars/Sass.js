const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

const { config } = require('../utils');

module.exports = class SassParser extends DocsParser {
  static settings = {
    commentType: 'single',
    curlyTypes: true,
    typeInfo: true,
    typeTag: 'type',
    prefix: '///',
    varIdentifier: '\\$[a-zA-Z_-][a-zA-Z_0-9-]*',
    fnIdentifier: '[a-zA-Z_-][a-zA-Z_0-9-]*',
    fnOpener: '@(?:mixin|function)\\s+[a-zA-Z_-][a-zA-Z_0-9-]*\\s*[\\(|\\{]',
    bool: 'Boolean'
  };

  static parseFunction (line) {
    const r = '^\\s*@(?P<fnType>(mixin|function))\\s+' +
          '(?P<name>' + this.settings.fnIdentifier + ')' +
          '\\s*(?:\\(\\s*(?P<args>.*?)\\)|{)';
    const regex = xregexp(r);

    const matches = xregexp.exec(line, regex);
    if (matches === null) { return null; }

    return [
      matches.name,
      (matches.args ? matches.args.trim() : null),
      (matches.fnType === 'mixin' ? null : false)
    ];
  }

  static parseVar (line) {
    //   $foo: blah;
    const r = '(?P<name>' + this.settings.varIdentifier + ')' +
          '\\s*:\\s*(?P<val>.*?)(?:;|$)';
    const regex = xregexp(r);

    const matches = xregexp.exec(line, regex);

    if (matches === null) {
      return null;
    }
    // variable name, variable value
    return [matches.name, matches.val.trim()];
  }

  static parseArg (arg) {
    const regex = xregexp(
      '(?P<name>' + this.settings.varIdentifier + ')(\\s*:\\s*(?P<value>.*))?'
    );

    return xregexp.exec(arg, regex);
  }

  static getArgType (arg) {
    const matches = this.parseArg(arg);

    if (matches && matches.value) {
      return this.guessTypeFromValue(matches.value);
    }

    return null;
  }

  static getArgName (arg) {
    const matches = this.parseArg(arg);

    if (matches && matches.value) {
      return `${matches.name} [${matches.value}]`;
    } else if (matches && matches.name) {
      return matches.name;
    }

    // a invalid name was passed
    return null;
  }

  static guessTypeFromValue (val) {
    const shortPrimitives = config.get('short_primitives');

    // It doesn't detect string without quotes, because it could be a color name
    // It doesn't detect empty lists or maps, because they have the same syntax

    if (this.isMap(val)) {
      return 'map';
    }
    if (this.isList(val)) {
      return 'list';
    }
    if (this.isNumeric(val[0])) {
      return 'number';
    }
    if ((val[0] === '\'') || (val[0] === '"')) {
      return 'string';
    }
    if (val === 'null') {
      return 'null';
    }
    if ((val === 'true') || (val === 'false')) {
      return (shortPrimitives ? 'Bool' : 'Boolean');
    }
    if (this.isColor(val)) {
      return 'color';
    }

    return null;
  }

  static getFunctionReturnType (name, retval) {
    if (retval) {
      return retval;
    }

    return super.getFunctionReturnType(name, retval);
  }

  static isColor (val) {
    const expr = new RegExp('^(' +
          // #FFF
          '#[0-9a-f]{3}' +
          '|' +
          // #EFEFEF
          // #02060901
          '#(?:[0-9a-f]{2}){2,4}' +
          '|' +
          // rgb(0,0,0)
          // hsla(0,0,0,0)
          // hsl(0,0,0,0)
          // rgba(0,0,0)
          '(rgb|hsl)a?\\((-?\\d+%?[,\\s]+){2,3}\\s*[\\d\\.]+%?\\))' +
          '$', 'i');
    return expr.test(val);
  }

  static isMap (val) {
    const expr = new RegExp('^\\(\\s*' + this.settings.fnIdentifier + '\\s*:');
    return expr.test(val);
  }

  static isList (val) {
    const expr = new RegExp('^(' +
          // [example, list]
          '\\[' +
          '|' +
          // (example, list)
          '\\(' +
          ')?' +
          // example list
          // example, list
          '[a-zA-Z_0-9$][a-zA-Z_0-9-]*([,\\s]+[a-zA-Z_0-9$][a-zA-Z_0-9-]*)+' +
          '(\\]|\\))?$');
    return expr.test(val);
  }
};
