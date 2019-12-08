var DocblockrWorker = require('./docblockr-worker.js');
var Disposable = require('atom').Disposable;

module.exports = {
  config: {
    simple_mode: {
      title: 'Enable simple mode',
      description: 'When enabled no automatic documentation is created when writing block comments.',
      type: 'boolean',
      default: false,
      order: 1
    },
    align_tags: {
      title: 'Align tag descriptions',
      description: 'Whether the components following the tags should be aligned.',
      type: 'string',
      default: 'deep',
      enum: [
        { value: 'no', description: 'Don\'t allign components.' },
        { value: 'shallow', description: 'Only allign the first tag component.' },
        { value: 'deep', description: 'Allign all tag components.' }
      ],
      order: 2
    },
    min_spaces_between_columns: {
      title: 'Minimum component indent',
      description: 'The minimum number of spaces used to sepperate tag components.',
      type: 'integer',
      default: 1,
      minimum: 1,
      order: 3
    },
    extra_tags: {
      title: 'Extra tags',
      description: 'An array of strings, each representing extra tags or arbitary text to add to function docblocks.',
      type: 'array',
      default: [],
      items: { type: 'string' },
      order: 4
    },
    extra_tags_go_after: {
      title: 'Include extra tags last',
      description: 'Whether extra tags are added at the end of the block, rather than at the start.',
      type: 'boolean',
      default: false,
      order: 5
    },
    return_tag: {
      title: 'Use \'@returns\' tag',
      description: 'By default, \'@return\' is used, however this can be changed to \'@returns\' instead.',
      type: 'string',
      default: '@return',
      order: 6
    },
    auto_add_method_tag: {
      title: 'Add \'@method\' tag',
      description: 'Whether to add the method tag to function docblocks.',
      type: 'boolean',
      default: false,
      order: 7
    },
    spacer_between_sections: {
      title: 'Newline between sections',
      description: 'Whether to inclued a newline between differing tags.',
      type: 'string',
      default: 'false',
      enum: [
        { value: 'false', description: 'Don\'t add newlines.' },
        { value: 'after_description', description: 'Only add a newline between the description and the first tag.' },
        { value: 'true', description: 'Add newlines between all differing tags.' }
      ],
      order: 8
    },
    newline_after_block: {
      title: 'Newline after block',
      description: 'When enabled an additional newline is added after the docblock to separate it from the code.',
      type: 'boolean',
      default: false,
      order: 9
    },
    lower_case_primitives: {
      title: 'Lowercase primitives',
      description: 'When enabled primitive data types are written in lower case, e.g. \'number\' instead of \'Number\'.',
      type: 'boolean',
      default: false,
      order: 10
    },
    short_primitives: {
      title: 'Short primitives',
      description: 'When enabled primitive data types are abbreviated, e.g. \'Bool\' instead of \'Boolean\'.',
      type: 'boolean',
      default: false,
      order: 11
    },
    return_description: {
      title: 'Return description',
      description: 'Whether to inclued a description field for function return values.',
      type: 'boolean',
      default: true,
      order: 12
    },
    param_description: {
      title: 'Parameter description',
      description: 'Whether to inclued a description field for function parameter.',
      type: 'boolean',
      default: true,
      order: 13
    },
    indentation_spaces: {
      title: 'Indentation spaces',
      description: 'The number of spaces to indent after the leading asterisk.',
      type: 'integer',
      default: 1,
      minimum: 0,
      order: 14
    },
    indentation_spaces_same_para: {
      title: 'Line wrap indentation spaces',
      description: 'The number of additional indentation spaces when wrapping text over multiple lines',
      type: 'integer',
      default: 1,
      minimum: 0,
      order: 15
    },
    deep_indent: {
      title: 'Do deep indenting',
      description: 'Whether pressing tab at the start of a line in docblock should indent to match the previous line\'s description field.',
      type: 'boolean',
      default: false,
      order: 16
    },
    extend_double_slash: {
      title: 'Extend double-slash comments',
      description: 'Whether pressing enter on a \'//\' line should also comment out the next.',
      type: 'boolean',
      default: true,
      order: 17
    },
    c_style_block_comments: {
      title: 'C-style block comments',
      description: 'When enabled block comments will have asterisks added on following lines.',
      type: 'boolean',
      default: false,
      order: 18
    },
    notation_map: {
      type: 'array',
      default: [],
      order: 9001
    },
    per_section_indent: {
      type: 'boolean',
      default: false,
      order: 9002
    },
    override_js_var: {
      type: 'boolean',
      default: false,
      order: 9003
    },
    development_mode: {
      type: 'boolean',
      default: false,
      order: 9004
    }
  },

  activate: function () {
    return (this.Docblockr = new DocblockrWorker());
  },

  consumeSnippetsService: function (service) {
    this.Docblockr.setSnippetsService(service);
    return new Disposable(() => {
      this.Docblockr.setSnippetsService(null);
    });
  }
};
