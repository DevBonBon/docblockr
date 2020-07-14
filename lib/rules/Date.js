const Rule = require('../Rule');

module.exports = class Date extends Rule {
  static identifier = 'date';

  static apply (index) {
    return [index, (new Date()).toISOString().replace(/T.*/, '')]
  }
};
