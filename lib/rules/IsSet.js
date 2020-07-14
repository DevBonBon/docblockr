const Rule = require('../Rule');

module.exports = class IsSet extends Rule {
  static identifier = '&';

  static apply (index, substitutions, { scope }) {
    return [index + 2, scope & substitutions[index + 1]
      ? substitutions[index + 2]
      : ''];
  }
};
