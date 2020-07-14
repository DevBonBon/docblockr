const Docblockr = require('./Docblockr');

// do all the unlegal things here
module.exports = class DocblockrWrapper extends Docblockr {
  static activate ({ addCommentMatcher, addGrammar } = this.docblockr()) {
    super.activate();

    // JavaScipt
    // 94 - "
    // 96 - '
    // 99 - comment
    // 100 - `
    // 103 - regex_pattern
    // 193 - string
    // 194 - template_string
    addCommentMatcher(['source.js'], [['/*']], [96, 99, 103, 193, 194]);
    addGrammar(['source.js'], { inline: [['//']], block: [['/*']], doc: [['/**', '*/']] }, [99]);
  }
};
