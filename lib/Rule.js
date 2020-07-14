module.exports = class Rule {
  static identifier;

  static apply (index, substitutions, block) {
    return [index, block.toString()];
  }
};
