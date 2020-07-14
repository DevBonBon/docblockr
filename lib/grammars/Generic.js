const Section = require('../Section');

class Generic {
  constructor () {
    this.comment = {
      inline: ['//'],
      block: ['/*', '*/'],
      docblock: ['/**', '*/']
    };

    this.types = {
      UNKNOWN: null,
      NONE: '',
      ARRAY: 'Array',
      OBJECT: 'Object',
      STRING: 'String',
      NUMBER: 'Number',
      BOOLEAN: 'Boolean',
      FUNCTION: 'Function'
    };

    this.dictionary = {
      type: {
        null: this.types.NONE,
        undefined: this.types.UNKNOWN
      }
    };

    this.entries = [];
    this.pattern = [];
    this.disabled = [];
  }

  // Converts given nodes into Blocks according to a language typeId pattern
  // TODO: go over this one more time to make sure its compact
  // TODO: Can be simplified using optional chaining
  // TODO: Concate, rather than recurse (that computerphile video)
  parse (nodes = [], pattern = this.pattern) {
    return nodes.flatMap(node =>
      // Discard nodes that don't exist in given pattern
      !pattern.has(node.typeId) ? []
        // Check if node subpattern is a function
        : pattern.get(node.typeId) instanceof Function
          // Document node using the pattern function
          ? pattern.get(node.typeId)(node).map(block =>
            // Allows sections to be applied broadly inside the typeId pattern
            this.translate(new Section(Object.fromEntries([...pattern, ...block]))))
          // Recurse with named child nodes and their corresponding subpattern
          : this.parse(node.namedChildren,
            new Map([...pattern].flatMap(([key, value]) =>
              // Only keep matching typeId subpattern
              key === node.typeId
                ? value
                // Only keep section mappings, discard any typeId subpatterns
                : Number.isInteger(key) ? []
                  : [[key, value]]))));
  }

  // TODO: Can be simplified using optional chaining
  // TODO: Can be simplified using nullish coalescing operator
  translate (block) {
    Object.keys(block).forEach(key => {
      block[key] = this.dictionary[key]
        ? this.dictionary[key][block[key]] != null
          ? this.dictionary[key][block[key]]
          : block[key]
        : block[key];
    });
    return block;
  }

  // Return an array of Blocks
  static identifier (node) {
    return [
      [
        ['identifier', node.text]
      ]
    ];
  }

  static assignment (node) {
    return [
      [
        ['identifier', node.leftNode.text],
        ['value', node.rightNode.text],
        ['type', node.rightNode.type],
        ['typeId', node.rightNode.typeId]
      ]
    ];
  }

  static value (node) {
    return [
      [
        ['value', node.text],
        ['type', node.type],
        ['typeId', node.typeId]
      ]
    ];
  }
}

module.exports = Generic;
