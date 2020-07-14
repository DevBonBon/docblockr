const Rule = require('../Rule');

module.exports = class And extends Rule {
  static identifier = '&&';

  static apply (index, substitutions, block) {
    // TODO: Can be simplified using nullish coalescing operator
    return [index + 2, block[substitutions[index + 1]] != null
      ? substitutions[index + 2]
      : ''];
  }
};
