const Docblock = require('./Docblock');
const Section = require('./Section');

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
   * @param   {Number} test4  [description]
   * @param   {Number} [inline=1]  [description]
   * @return  {[type]} [description]
   * @throws  {[type]} [description]
   * @example
   * @todo    [code]
   */
  static testDocumenting (definition, { test: test2, test3: test4 = 3, test5 }, inline = 1) {
    return {};
  }

  // TODO: type(id)s are language specific ([grammar].languageModule.nodeSubclasses)
  // with optional chaining
  // takes an array of nodes and a pattern
  // check each node if they exist in pattern
  // if they do, check if subpattern is a function
  // if it is, return subpattern(node) <- will return an array of tags
  // else recurse with nodes children and subpattern
  // stop if array of nodes is empty
  // return a flat array of tags
  // TODO: Can be simplified using optional chaining
  static document (nodes, pattern = new Map()) {
    // Converts given nodes into Blocks according to a language typeId pattern
    return nodes.flatMap(node =>
      // Check if node exists in pattern
      pattern.has(node.typeId)
        // Check if node subpattern is a function
        ? pattern.get(node.typeId) instanceof Function
          // Document node using pattern function
          ? pattern.get(node.typeId)(node)
            // Allow block sections to be applied broadly in the pattern mapping
            .map(block => new Section(Object.fromEntries([...pattern, ...block])))
          // Recurse with child nodes and their corresponding pattern
          : DocsParser.document(node.namedChildren,
            // Remove unwanted typeId mappings by converting them to null
            new Map([...pattern].flatMap(([key, value]) =>
              key === node.typeId
                ? value
                : !Number.isInteger(key)
                  ? [[key, value]]
                  : [null, null])))
        // Discard node
        : []);
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
