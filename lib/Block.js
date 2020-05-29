class Block {
  constructor ({ tag, identifier, value, type }) {
    this.tag = tag;
    this.identifier = identifier;
    this.value = value;
    this.type = type;
  }

  document ([template, sections], head = -1) {
    return String.raw({ raw: template },
      ...sections.flatMap((section, index) => {
        if (head < index) {
          [section, head] = Block.rules.has(section)
            ? Block.rules.get(section)(this, sections, index)
            : [this[section], index];
          return Array.isArray(section)
            ? this.document(section)
            : section;
        }
        return [];
      }
      ));
  }
}

Block.rules = new Map([
  ['date', (block, sections, index) =>
    [(new Date()).toISOString().replace(/T.*/, ''), index]],
  ['datetime', (block, sections, index) =>
    [(new Date()).toISOString().replace(/Z$/, ''), index]],
  // section or default -doesnt work, index bad-
  ['=', (block, sections, index, head = index + 2) =>
    [block[sections[++index]] || sections[++index], head]],
  // if section is truthy, next value, or none
  ['&', (block, sections, index, head = index + 2) =>
    [block[sections[++index]] ? sections[++index] : '', head]]
]);

module.exports = Block;
