// just an array of jsdoc tags
// special tags for documentables name, description etc.
class Docblock extends Map {
  constructor (blocks) {
    super(blocks.map(block => [block.tag, block]));
  }
}

module.exports = Docblock;
