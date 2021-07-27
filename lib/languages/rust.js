const DocsParser = require('../docsparser');
const xregexp = require('xregexp');

const { config } = require('../utils');

module.exports = class RustParser extends DocsParser {
  static settings = {
    commentType: 'block',
    curlyTypes: false,
    typeInfo: false,
    typeTag: false,
    prefix: '///',
    varIdentifier: '[a-zA-Z_][a-zA-Z_0-9]*',
    fnIdentifier: '[a-zA-Z_][a-zA-Z_0-9]*',
    classIdentifier: '[A-Z_][a-zA-Z0-9]*',
    fnOpener: '^\\s*fn',
    commentCloser: '///',
    bool: 'bool',
    function: 'fn'
  };

  static parseClass (line) {
    // preamble looks for #[derive] and or pub if any
    const preamble = '^[\\s*\\n]*(#\\[.+\\])?[\\s\\n]*(\\bpub([(].+[)])?)?';
    const regex = xregexp(
      preamble + '\\s*(struct|trait|enum)\\s+(?P<name>' + this.settings.classIdentifier + ')'
    );

    const matches = xregexp.exec(line, regex);
    if (matches === null || matches.name === undefined) {
      return null;
    }
    const name = matches.name;
    return [name];
  }

  static parseFunction (line) {
    // TODO: add regexp for closures syntax

    // preamble looks for #[derive] and or pub if any
    const preamble = '^[\\s*\\n]*(#\\[.+\\])?[\\s\\n]*(\\bpub([(].+[)])?)?';

    const regex = xregexp(
      preamble +
                '\\s*fn\\s+(?P<name>' + this.settings.fnIdentifier + ')' +
                '([<][a-zA-Z, _]+[>])?' + // Type parameters if any
                '\\s*\\(\\s*(?P<args>.*?)\\)' + // List of parameters
                '(\\s*[-][>]\\s*(?P<retval>[^{]+))?' + // Return value if any
                '\\s*[{;]?' // closing brace if any
    );

    const matches = xregexp.exec(line, regex);
    if (matches === null || matches.name === undefined) {
      return null;
    }
    const name = matches.name;
    const args = (matches.args ? matches.args.trim() : null);
    const retval = (matches.retval ? matches.retval.trim() : null);
    return [name, args, retval];
  }

  static parseVar (line) {
    // TODO: add support for struct and tuple destructuring
    // TODO: parse type and value
    const preamble = '^[\\s\\n]*(#\\[.+\\])?[\\s\\n]*';
    const regex = xregexp(
      preamble +
                '\\s*let\\s+(mut\\s+)?(?P<name>' + this.settings.varIdentifier + ')'
    );

    const matches = xregexp.exec(line, regex);
    if (matches === null || matches.name === undefined) {
      return null;
    }

    const name = matches.name;
    return [name, null, null];
  }

  static formatFunction (name, args, retval) {
    const out = [];
    let varCount = 1;
    out.push('${' + varCount + ':short description}');
    varCount += 1;
    out.push('');
    out.push('${' + varCount + ':long description}');
    varCount += 1;

    if (args && config.get('param_description')) {
      // console.log(args);
      let lstArgs = args.split(',');
      lstArgs = lstArgs.filter(arg => arg.includes(':'));
      // console.log(lstArgs);
      if (lstArgs.length > 0) {
        out.push('');
        out.push('# Parameters');
        lstArgs.forEach(lstArg => {
          const regex = xregexp('^\\s*(?P<name>' + this.settings.varIdentifier + '):\\s*(?<type>.+)\\s*$');
          const matches = xregexp.exec(lstArg, regex);
          if (matches) {
            out.push('');
            out.push('* `' + matches.name + '` - ${' + varCount + ':' + matches.name + '}');
            varCount += 1;
          }
        });
      }
    }

    if (retval && config.get('return_description')) {
      out.push('');
      out.push('# Returns');
      out.push('');
      out.push('${' + varCount + ':returns description}');
      varCount += 1;
    }

    return out;
  }

  static formatClass (name) {
    return ['${1:describe ' + name + '}'];
  }

  static formatVar (name, val, valType) {
    return ['${1:describe ' + name + '}'];
  }
};
