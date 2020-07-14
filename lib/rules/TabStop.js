const Rule = require('../Rule');

module.exports = class TabStop extends Rule {
  static identifier = '$';

  static apply (index, substitutions, block) {
    return block.tabStop
      ? substitutions[index + 1] != null
        ? [index + 1, [[`\${${block.tabStop++}:${substitutions[index + 1]}}`]]]
        : [index, `$${block.tabStop++}`]
      : [index + 1, substitutions[index + 1] || ''];
  }
};
