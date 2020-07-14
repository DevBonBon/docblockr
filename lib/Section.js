class Section {
  constructor ({ tag, identifier, value, type, typeId }) {
    this.tag = tag;
    this.identifier = identifier;
    this.value = value;
    this.type = type;
    this.typeId = typeId;
  }

  toString () {
    return `${this.type ? `{${this.type}} ` : ''}${this.identifier}${this.value ? `=${this.value}` : ''}`;
  }

  document (scope, [template, sections = []], head = -1) {
    return String.raw({ raw: template },
      ...sections.flatMap((section, index) => {
        if (head < index) {
          [head, section] = Section.rules.has(section)
            ? Section.rules.get(section)(index, this, sections)
            : [index, this[section]];
          return Array.isArray(section)
            ? this.document(section)
            : section;
        }
        return [];
      }
      ));
  }
}

module.exports = Section;
