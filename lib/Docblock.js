const fs = require('fs');
const path = require('path');

module.exports = class Docblock {
  static get rules () {
    delete this.rules;
    return (this.rules = new Map(fs.readdirSync(path.join(module.filename, '../rules'))
      .map(file => {
        const rule = require(path.join(module.filename, '../rules', file));
        return [rule.identifier, rule];
      })));
  }

  constructor (scope, tabStop, { entries, pattern, dictionary } = {}) {
    this.scope = scope;
    this.tabStop = tabStop;

    this.entries = entries;
    this.pattern = pattern;
    this.dictionary = dictionary;
  }

  set blocks (blocks) {
    delete this.blocks;
    this.blocks = blocks;
  }

  get blocks () {
    const { row, column } = this.cursor.getBufferPosition();
    const start = { row, column };
    const end = { row: row + 10, column }; // Make configurable

    const [node] = this.cursor.editor.languageMode.tree.rootNode.descendantsOfType(this.entries, start, end);

    return (this.blocks = Docblock.parse([node], this.pattern));
  }

  document ([template, substitutions = []], block = this, head = -1) {
    return String.raw({ raw: template },
      ...substitutions.flatMap((substitution, index) => {
        if (head < index) {
          [head, substitution] = Docblock.rules.has(substitution)
            ? Docblock.rules.get(substitution).apply(index, substitutions, block)
            : [index, block[substitution]]; // || ''
          return Array.isArray(substitution)
            ? this.document(substitution, block)
            : substitution;
        }
        return [];
      }));
  }

  // TODO: Could probably do with better variable names
  record (node, records) {
    return records.flatMap(record => record instanceof Object
      ? Object.fromEntries(Object.entries(record).map(([key, value]) =>
        [key, value.reduce((result, property) => result[property], node)]))
      : this.record(node, this.recorders[record]));
  }

  createTag (tag) {
    return new Tag(tag, this.template, this.dictionary);
  }

  // Converts given nodes into Blocks according to a language typeId pattern
  // TODO: Can be simplified using optional chaining
  // TODO: Try to make tail recursive?
  parse (nodes, { tag, identifier, value, type, ...pattern } = this.pattern) {
    return nodes.flatMap((node, { typeId, namedChildren } = node) =>
      // Discard nodes that don't exist in given pattern
      !(typeId in pattern) ? []
        // Check if node subpattern is an array
        : Array.isArray(pattern[typeId])
          // Document node using the pattern function
          ? this.record(pattern[typeId], node).map(tag =>
            // Allows sections to be applied broadly inside the typeId pattern
            this.createTag({ tag, identifier, value, type, ...tag }))
          // Recurse with named child nodes and their corresponding subpattern
          : this.parse(namedChildren, { tag, identifier, value, type, ...pattern[typeId] }));
  }

  // TODO: Can be simplified using optional chaining
  // TODO: Can be simplified using nullish coalescing operator
  static translate (block, dictionary) {
    Object.keys(block).forEach(key => {
      block[key] = dictionary[key]
        ? dictionary[key][block[key]] != null
          ? dictionary[key][block[key]]
          : block[key]
        : block[key];
    });
    return block;
  }
};
