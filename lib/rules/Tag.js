const Rule = require('../Rule');

module.exports = class Defined extends Rule {
  static identifier = '@';

  static apply (index, substitutions, block) {
    if (blocks in block) {
      const tags = [];
      docblock.blocks = docblock.blocks.filter(block =>
        block.tag === placeholders[index + 1]
          ? !tags.push(block)
          : true
      );
      return [index + 2, tags.map(tag =>
        docblock.document(placeholders[index + 2], {...block, ...tag})).join('')];
    }
    return [index, ''];
  }
};
