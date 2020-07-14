const Rule = require('../Rule');

module.exports = class DateTime extends Rule {
  static identifier = 'datetime';

  static apply (index) {
    return [index, (new Date()).toISOString().replace(/Z$/, '')]
  }
};
