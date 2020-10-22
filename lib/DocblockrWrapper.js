const Docblockr = require('./Docblockr');

// do all the unlegal things here
module.exports = class DocblockrWrapper extends Docblockr {
  static activate (...args) {
    super.activate(...args);
    const { addCommentMatcher, addGrammar } = super.docblockr();
    // JavaScipt
    // 94 - "
    // 96 - '
    // 99 - comment
    // 100 - `
    // 103 - regex_pattern
    // 193 - string
    // 194 - template_string
    addCommentMatcher(['source.js'], [96, 99, 103, 193, 194], [['/*']]);
    addGrammar(['source.js'], [99], { comments: { inline: [['//']], block: [['/*']], doc: [['/**', '*/']] } });
  }
};
