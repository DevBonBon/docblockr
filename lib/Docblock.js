module.exports = class Docblock {
  constructor (scope, { entries, pattern, dictionary }) {
    this.scope = scope;
    this.entries = entries;
    this.pattern = pattern;
    this.dictionary = dictionary;

    return new Proxy(this, {
      get: (target, property) => {

      }
    });
  }

  get blocks () {
    const { row, column } = this.cursor.getBufferPosition();
    const start = { row, column };
    const end = { row: row + 10, column }; // Make configurable

    const [node] = this.cursor.editor.languageMode.tree.rootNode.descendantsOfType(this.entries, start, end);

    return (this.blocks = Docblock.parse([node], this.pattern));
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
