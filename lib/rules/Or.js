const Rule = require('../Rule');

module.exports = class Or extends Rule {
  static identifier = '||';

  static apply (index, substitutions, block) {
    // TODO: Can be simplified using nullish coalescing operator
    return [index + 2, block[substitutions[index + 1]] != null
        ? block[substitutions[index + 1]]
        : substitutions[index + 2]];
  }
};
