const Block = require('../Block');

class Generic {
  // Converts given nodes into Blocks according to a language typeId pattern
  // TODO: go over this one more time to make sure its compact
  // TODO: Can be simplified using optional chaining
  static document (nodes, pattern = new Map()) {
    return nodes.flatMap(node =>
      // Discard nodes that don't exist in given pattern
      !pattern.has(node.typeId) ? []
        // Check if node subpattern is a function
        : pattern.get(node.typeId) instanceof Function
          // Document node using the pattern function
          ? pattern.get(node.typeId)(node)
            // Allows sections to be applied broadly inside the typeId pattern
            .map(block => new Block(Object.fromEntries([...pattern, ...block])))
          // Recurse with named child nodes and their corresponding subpattern
          : Generic.document(node.namedChildren,
            new Map([...pattern].flatMap(([key, value]) =>
              // Only keep matching typeId subpattern
              key === node.typeId
                ? value
                // Only keep section mappings, discard any typeId subpatterns
                : Number.isInteger(key) ? []
                  : [[key, value]]))));
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
        ['type', node.rightNode.typeId]
      ]
    ];
  }

  static primitive (node) {
    return [
      [
        ['value', node.text],
        ['type', node.typeId]
      ]
    ];
  }
}

Generic.comment = {
  inline: ['//'],
  block: ['/*', '*/'],
  docblock: ['/**', '*/']
};

Generic.primitives = {
  NONE: '',
  ARRAY: 'Array',
  OBJECT: 'Object',
  STRING: 'String',
  NUMBER: 'Number',
  BOOLEAN: 'Boolean',
  FUNCTION: 'Function'
};

Generic.types = {};
Generic.entryTypes = [];
Generic.pattern = {};
Generic.disabled = [];

Generic.order = [
  '@name',
  '@param',
  '@returns'
];

module.exports = Generic;
