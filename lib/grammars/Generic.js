class Generic {
  static identifier (node) {
    return [{
      identifier: node.text
    }];
  }

  static assignment (node) {
    return [{
      identifier: node.leftNode.text,
      value: node.rightNode.text,
      type: node.rightNode.typeId
    }];
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

Generic.order = [
  '@name',
  '@param',
  '@returns'
];

module.exports = Generic;
