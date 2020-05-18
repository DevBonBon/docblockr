const Docblock = require('./Docblock');
const Block = require('./Block');

/**
 * [DocsParser description]
 */
class DocsParser {
  /**
   * Tries to guess the type of given string using the defined notations
   * See 'DocsParser.notation.map' and 'DocsParser.notation.checks'
   * @param  {String} string String to define, function name, variable value, etc.
   * @return {Array}  Guess at the type, with checks used as the second value
   */
  static guessType (string) {
    return Object.entries(config.get('notations'))
      .find(([type, patterns]) => patterns
        .some(pattern => Object.entries(pattern)
          .every(([check, matches]) => matches
            .some(match => DocsParser.notation.checks[check](string, match)))));
  }

  /**
   * [documentClass description]
   * @param   {[type]} definition  [description]
   * @param   {[type]} test  [description]
   * @param   {[type]} test2  [description]
   * @param   {[type]} test4  [description]
   * @param   {Number} [inline=1]  [description]
   * @return  {[type]} [description]
   * @throws  {[type]} [description]
   * @example
   * @todo    [code]
   */
  static testDocumenting (definition, { test: test2, test2: test3 = 3, test4 }, inline = 1) {
    return {};
  }

  // TODO: type(id)s are language specific ([grammar].languageModule.nodeSubclasses)
  // TODO: this function can check (and the logic in general) can made made cleaner
  // with optional chaining
  // takes an array of nodes and a pattern
  // check each node if they exist in pattern
  // if they do, check if subpattern is a function
  // if it is, return subpattern(node) <- will return an array of tags
  // else recurse with nodes children and subpattern
  // stop if array of nodes is empty
  // return a flat array of tags
  // TODO: Can be simplified using Object.fromEntries
  // TODO: Can be simplified using optional chaining
  static document (nodes, pattern = {}) {
    return nodes.reduce((docblock, node) => {
      if (node.typeId in pattern) {
        if (pattern[node.typeId] instanceof Function) {
          docblock.push(...pattern[node.typeId](node)
            // Allow block sections to be applied broadly in the pattern mapping
            .map(block => new Block({ ...pattern, ...block })));
        } else {
          docblock.push(...DocsParser.document(node.children,
            {
              // Remove typeId mappings by assigning them to null
              ...Object.entries(pattern).reduce((template, [key, value]) => ({
                ...template,
                [!Number.isInteger(key) ? key : null]: value
              }), {}),
              ...pattern[node.typeId]
            }));
        }
      }
      return docblock;
    }, new Docblock());
  }
}

// Notation checking functions and default Type Name : Patterns Map.
// TODO: Add a note about using an objecct over a Map, atom.config, looks nicer, is slower?
DocsParser.notation = {
  checks: {
    regex: (string, match) => (new RegExp(match)).test(string),
    prefix: (string, match) => string.startsWith(match),
    suffix: (string, match) => string.endsWith(match),
    equals: (string, match) => string === match
  },
  /** @type {Object} Map, Type:Patterns. Some Pattern has to match. Configurable. */
  map: {
    /* Names are arbritary. Will be converted if primitive, otherwise used as is. */
    NONE: [
    /** @type {Object} Pattern, Check:Matches. All Checks have to have one Match. */
      { prefix: ['set', 'add'] }
    ],
    ARRAY: [
      { prefix: ['['], suffix: [']'] }
    ],
    OBJECT: [
      { prefix: ['{'], suffix: ['}'] }
    ],
    STRING: [
      { prefix: ['\'', '"', '`'], suffix: ['\'', '"', '`'] }
    ],
    NUMBER: [
      { regex: ['^[\\d.]+$'] }
    ],
    BOOLEAN: [
      { prefix: ['is', 'has'] },
      { equals: ['true', 'false'] }
    ],
    FUNCTION: [
      { equals: ['cb', 'callback', 'done', 'next', 'fn'] }
    ]
  }
};

module.exports = DocsParser;
