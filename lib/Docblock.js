module.exports = class Docblock extends Map {
  constructor (documenter, templates, children) {
    super();

    this.scope = scope;
    this.entries = entries;
    this.pattern = pattern;
    this.dictionary = dictionary;

    return new Proxy(this, {
      get: (target, property) => {

      }
    });
  }

  add ({ tag, ...rest }) {
    this.has(tag) ? this.get(tag).push(rest) : this.set(tag, [rest]);
  }

  // TODO: Could probably do with better variable names
  record (node, base, recordables) {
    recordables.forEach(recordable => {
      if (recordable in this.recorders) {
        // Resolve all propertypaths defined in recorder
        this.recorders[recordable].forEach(tag =>
          // Reduce the property path into a value from the given node
          this.add({
            ...base,
            ...Object.fromEntries(Object.entries(tag).map(([key, propertyPath]) =>
              [key, propertyPath.reduce((property, path) => property[path], node)]))
          }));
      }
    });
  }

  createTag (tag) {
    return new Tag(tag, this.template, this.dictionary);
  }

  // Converts and adds given nodes as tags according to a language typeId pattern
  static parse (nodes, pattern, block = new Map()) {
    // Allows sections to be applied broadly inside the typeId pattern
    const base = Object.fromEntries(Object.entries(pattern)
      .filter(([key]) => !Number.isNumber(key)));
    // Discard nodes that don't exist in given pattern
    nodes.forEach(node => {
      if (node.typeId in pattern) {
        // Check if node subpattern is an array
        !Array.isArray(pattern[node.typeId])
          // Document node using the pattern function
          ? block.record(node, base, pattern[node.typeId])
          // Recurse with named child nodes and their corresponding subpattern
          : this.parse(node.namedChildren, { ...base, ...pattern[node.typeId] });
      }
    });
  }

  parse (nodes) {
    const block = new Map();
    return Docblock.parse(nodes, this.pattern, block)
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
