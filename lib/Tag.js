class Tag {
  constructor ({ tag, identifier, value, type }, template, dictionary) {
    this.template = template;
    this.dictionary = dictionary;

    // TODO: Can be simplified using optional chaining
    // TODO: Can be simplified using nullish coalescing operator
    this.tag = dictionary.tag && dictionary.tag[tag] != null
      ? dictionary.tag[tag]
      : tag;
    this.identifier = dictionary.identifier && dictionary.identifier[identifier] != null
      ? dictionary.identifier[identifier]
      : identifier;
    this.value = dictionary.value && dictionary.value[value] != null
      ? dictionary.value[value]
      : value;
    this.type = dictionary.type && dictionary.type[type] != null
      ? dictionary.type[type]
      : type;
  }

  // TODO: Can be simplified using optional chaining
  // TODO: Can be simplified using nullish coalescing operator
  static translate (block, dictionary) {
    Object.keys(block).forEach(key => {
      block[key] = dictionary[key]
        ? dictionary[key][block[key]] != null
          ? dictionary[key][block[key]]
          : block[key]
        : block[key];
    });
    return block;
  }

  create ({ tag, identifier, value, type }) {

  }
}

module.exports = Tag;
