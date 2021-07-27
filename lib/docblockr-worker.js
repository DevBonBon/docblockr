const { config, escape } = require('./utils');

const DocsParser = require('./docsparser');

// const Snippets = global.atom.packages.activePackages.snippets.mainModule;
module.exports = class DocBlockrAtom {
  /**
   * Field and accessors for the Snippets API Object
   * A getter is used so a notification can be issued if the service is unavailable
   * @type {Object}
   */
  static #snippets = null;

  static set snippets (service) {
    this.#snippets = service;
  }

  static get snippets () {
    if (this.#snippets == null) {
      atom.notifications.addError('Docblockr: Missing Snippets service.', {
        description: 'Please ensure the Snippets package is enabled.',
        dismissable: true
      });
    }

    return this.#snippets;
  }

  /**
   * Each element represents a supported Grammar as an array of aliases.
   * The first value is used as the parser file and Grammar name.
   * @type {Array}
   */
  static #PARSERS = [
    ['ActionScript', 'ActionScript 3', 'Haxe'],
    ['C', 'C++', 'CUDA'],
    ['CoffeeScript'],
    ['Java', 'Groovy', 'Processing'],
    ['JavaScript'],
    ['Objective-C', 'Objective-C++'],
    ['PHP'],
    ['Rust'],
    ['Sass', 'SCSS'],
    ['TypeScript']
  ];

  /**
   * Fetch and cache a parser for the requested Grammar if available, or show
   * a warning notification and disable advanced documenting features if not.
   * @type {DocsParser}
   */
  static get parser () {
    const { name, scopeName } = atom.workspace.getActiveTextEditor().getGrammar();
    const [grammar] = this.#PARSERS.find(aliases => aliases.includes(name)) ?? [];
    if (grammar == null) {
      // No notification will be shown if simple mode is enabled globally
      if (!config.get('simple_mode', { scope: [scopeName] })) {
        atom.notifications.addWarning('Docblockr: Missing matching Parser.', {
          description: 'Unfortunatelly advanced features for the active Grammar are unsupported.',
          dismissable: true
        });
        atom.config.set('docblockr.simple_mode', true, { scopeSelector: `.${scopeName}` });
      }
      return DocsParser;
    }
    // Unset Grammar specific simple mode config
    atom.config.set('docblockr.simple_mode', undefined, { scopeSelector: `.${scopeName}` });
    return grammar in this.#PARSERS
      ? this.#PARSERS[grammar]
      : (this.#PARSERS[grammar] = require(`./grammars/${grammar}`));
  }

  /**
   * Regular expression for matching and replacing '{{placeholders}}'
   * @type {RegExp}
   */
  static #PLACEHOLDER = /\{\{(.*?)\}\}/g;
  /**
   * A Map of placeholder identifiers -> generating functions
   * @type {Object}
   */
  static #PLACEHOLDERS = {
    /**
     * Date at call time in the format of "1970-01-01"
     * @return {String}
     */
    date: () => new Date().toISOString().replace(/T.*/, ''),
    /**
     * Date aat call time in the format of "1970-01-01T00:00:00.000"
     * @return {String}
     */
    datetime: () => new Date().toISOString().replace(/Z$/, '')
  };

  static initialize () {
    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:parse-tab', event => {
      const regex = {
        // Parse Command
        parse: /^\s*(\/\*([*!])|###\*|\/\/\*|\/\/\/)\s*$/,
        // Indent Command
        indent: /^(\s*\*|\/\/\/)\s*$/
      };

      if (this.validateRequest(event, { preceding: true, precedingRegex: regex.parse })) {
        // Parse Command
        this.parseCommand(event, false);
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.indent })) {
        // Indent Command
        this.indentCommand(event);
      } else {
        event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:parse-enter', event => {
      const regex = {
        // Parse Command
        parse: /^\s*(\/\*([*!])|###\*|\/\/\*)\s*$/,
        // Trim auto whitespace
        trimAuto: [/^\s*\*\s*$/, /^\s*$/],
        // Deindent Command
        deindent: /^\s+\*\//,
        // Snippet-1
        snippetOne: [/^\s*\/\*$/, /^\*\/\s*$/],
        // Close block comment
        closeBlock: /^\s*\/\*\s*$/,
        // extend line
        extendLine: /^\s*(\/\/|#)/,
        // extend block
        extendBlock: /^\s*(\/\/[/!]?)/,
        // Extend docblock by adding an asterix at start
        extend: /^\s*\*(?:.?|.*(?:[^*][^/]|[^*]\/|\*[^/]))\s*$/
      };

      if (this.validateRequest(event, { preceding: true, precedingRegex: regex.parse })) {
        // Parse Command
        this.parseCommand(event, false);
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.trimAuto[0], following: true, followingRegex: regex.trimAuto[1], scope: 'comment.block' })) {
        // Trim auto whitespace
        this.trimAutoWhitespaceCommand(event);
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.deindent })) {
        // Deindent command
        this.deindentCommand(event);
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.snippetOne[0], following: true, followingRegex: regex.snippetOne[1] })) {
        // Snippet-1 command
        this.write(event, '\n$0\n ');
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.closeBlock })) {
        // Close block comment command
        this.parseBlockCommand(event);
      } else if (config.get('extend_double_slash') && this.validateRequest(event, { preceding: true, precedingRegex: regex.extendLine, scope: 'comment.line' })) {
        // Extend line comments (// and #)
        const _regex = /^(\s*[^\sa-z0-9]*\s*).*$/;
        const editor = event.currentTarget.getModel();
        const cursorPosition = editor.getCursorBufferPosition();
        let lineText = editor.lineTextForBufferRow(cursorPosition.row);
        lineText = lineText.replace(_regex, '$1');
        editor.insertText('\n' + lineText);
      } else if (config.get('extend_triple_slash') && this.validateRequest(event, { preceding: true, precedingRegex: regex.extendBlock, scope: 'comment.block' })) {
        // Extend block comments (/// and //!)
        const _regex = /^(\s*[^\sa-z0-9]*\s*).*$/;
        const editor = event.currentTarget.getModel();
        const cursorPosition = editor.getCursorBufferPosition();
        let lineText = editor.lineTextForBufferRow(cursorPosition.row);
        lineText = lineText.replace(_regex, '$1');
        editor.insertText('\n' + lineText);
      } else if (this.validateRequest(event, { preceding: true, precedingRegex: regex.extend, scope: 'comment.block' })) {
        // Extend docblock by adding an asterix at start
        const _regex = /^(\s*\*\s*).*$/;
        const editor = event.currentTarget.getModel();
        const cursorPosition = editor.getCursorBufferPosition();
        let lineText = editor.lineTextForBufferRow(cursorPosition.row);
        lineText = lineText.replace(_regex, '$1');
        editor.insertText('\n' + lineText);
      } else {
        event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:parse-inline', event => {
      // console.log('Parse-Inline command');
      const _regex = /^\s*\/\*{2}$/;

      if (this.validateRequest(event, { preceding: true, precedingRegex: _regex })) { this.parseCommand(event, true); } else {
        const editor = event.currentTarget.getModel();
        editor.insertNewline();
        // event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:join', event => {
      // console.log('Join command');
      if (this.validateRequest(event, { scope: 'comment.block' })) { this.joinCommand(event); }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:reparse', event => {
      // console.log('Reparse command');
      if (this.validateRequest(event, { scope: 'comment.block' })) { this.reparseCommand(event); }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:wrap-lines', event => {
      // console.log('Wraplines command');
      if (this.validateRequest(event, { scope: 'comment.block' })) { this.wrapLinesCommand(event); }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:decorate', event => {
      // console.log('Decorate command');
      if (this.validateRequest(event, { scope: 'comment.line' })) { this.decorateCommand(event); }
    });

    atom.commands.add('atom-text-editor:not([mini])', 'docblockr:decorate-multiline', event => {
      // console.log('Decorate Multiline command');
      if (this.validateRequest(event, { scope: 'comment.block' })) { this.decorateMultilineCommand(event); }
    });
  }

  /**
     * Validate the keypress request
     * @param  {Boolean}  preceding        Check against regex if true
     * @param  {Regex}    precedingRegex  Regex to check preceding text against
     * @param  {Boolean}  following        Check against regex if true
     * @param  {Regex}    followingRegex  Regex to check following text against
     * @param  {String}   scope            Check if cursor matches scope
     */
  static validateRequest (event, options) {
    /**
       *  Multiple cursor behaviour:
       *   1. Add mulitple snippets dependent on cursor pos, this makes traversing
       *        snippets not possible
       *   2. So we will iterate over the cursors and find the first among the cursors
       *        that satisfies the regex, the rest of the cursors will be deleted.
       */

    options = (typeof options !== 'undefined') ? options : {};

    const preceding = (typeof options.preceding !== 'undefined') ? options.preceding : false;
    const precedingRegex = (typeof options.precedingRegex !== 'undefined') ? options.precedingRegex : '';
    const following = (typeof options.following !== 'undefined') ? options.following : false;
    const followingRegex = (typeof options.followingRegex !== 'undefined') ? options.followingRegex : '';
    const scope = (typeof options.scope !== 'undefined') ? options.scope : false;

    const editor = event.currentTarget.getModel();

    const cursors = [];
    let i, len, followingText, precedingText;

    const cursorPositions = editor.getCursors();

    for (i = 0, len = cursorPositions.length; i < len; i++) {
      const cursorPosition = cursorPositions[i].getBufferPosition();

      if (scope) {
        const scopeList = editor.scopeDescriptorForBufferPosition(cursorPosition).getScopesArray();
        let _i, _len;
        for (_i = 0; _i < (_len = scopeList.length); _i++) {
          if (scopeList[_i].search(scope) > -1) {
            break;
          }
        }

        if (_i === _len) {
          // scope did not succeed
          continue;
        }
      }

      if (preceding) { precedingText = editor.getTextInBufferRange([[cursorPosition.row, 0], cursorPosition]); }

      if (following) {
        const lineLength = editor.lineTextForBufferRow(cursorPosition.row).length;
        const followingRange = [cursorPosition, [cursorPosition.row, lineLength]];
        followingText = editor.getTextInBufferRange(followingRange);
      }

      if (preceding && following) {
        if ((precedingText.search(precedingRegex) > -1) && (followingText.search(followingRegex) > -1)) {
          cursors.push(cursorPosition);
          break;
        }
      } else if (preceding) {
        if (precedingText.search(precedingRegex) > -1) {
          cursors.push(cursorPosition);
          break;
        }
      } else if (following) {
        if (followingText.search(followingRegex) > -1) {
          cursors.push(cursorPosition);
          break;
        }
      } else if (scope) {
        /* comes here only if scope is being checked */
        return true;
      }
    }

    if (cursors.length > 0) {
      cursorPositions.splice(i, 1);
      cursorPositions.forEach(value => value.destroy());
      return true;
    } else { return false; }
  }

  static parseCommand (event, inline = false) {
    const editor = event.currentTarget.getModel();
    // Avoid invoking the getter on every access
    const parser = this.parser;

    const { row, column } = editor.getCursorBufferPosition(); // will handle only one instance
    // Get trailing string
    const lineLength = editor.lineTextForBufferRow(row).length;
    const trailingRange = [[row, column], [row, lineLength]];
    let trailingString = editor.getTextInBufferRange(trailingRange);
    // drop trailing */
    trailingString = trailingString.replace(/\s*\*\/\s*$/, '');
    trailingString = escape(trailingString);

    const indentSpaces = ' '.repeat(config.get('indentation_spaces'));

    if (parser.isExistingComment(editor.lineTextForBufferRow(row + 1))) {
      this.write(event, `\n *${indentSpaces}`);
      return;
    }

    // erase characters in the view (will be added to the output later)
    editor.getBuffer().delete(trailingRange);

    let out = config.get('simple_mode', { scope: editor.getRootScopeDescriptor() })
      ? null
      // match against a function declaration.
      // use trailing string as a description of the function
      : parser.parse(parser.getDefinition(editor, { row: row + 1, column }), trailingString, inline);
    let snippet;

    if (out != null) {
      const settingsAlignTags = config.get('align_tags');
      const deepAlignTags = settingsAlignTags === 'deep';
      const shallowAlignTags = settingsAlignTags === 'shallow' || settingsAlignTags === true;
      // Substitute any placeholders in the tags
      out = out.map(line => line.replace(this.#PLACEHOLDER, (string, placeholder) =>
        placeholder in this.#PLACEHOLDERS
          ? this.#PLACEHOLDERS[placeholder]()
          : string));

      // align the tags
      if ((shallowAlignTags || deepAlignTags) && !inline) {
        // get the length of a string, after it is output as a snippet,
        // "${1:foo}" --> 3
        const outputWidth = str => str.replace(/[$][{]\d+:([^}]+)[}]/, '$1').replace('\\$', '$').length;
        // Grab the return tag if required.
        const returnTag = config.get('per_section_indent')
          ? config.get('return_tag')
          : false;

        // this is a 2d list of the widths per column per line
        const widths = [];
        // count how many columns we have
        let maxCols = out.reduce((maxCols, line) => {
          if (line.startsWith('@')) {
            // Ignore the return tag if we're doing per-section indenting.
            if (returnTag && line.startsWith(returnTag)) {
              return maxCols;
            }
            // ignore all the words after `@author`
            const columns = !line.startsWith('@author')
              ? line.split(' ')
              : ['@author'];
            widths.push(columns.map(outputWidth));
            return Math.max(maxCols, widths[widths.length - 1].length);
          }
          return maxCols;
        }, 0);

        // initialise a list to 0
        const maxWidths = new Array(maxCols).fill(0);

        if (shallowAlignTags) {
          maxCols = 1;
        }

        for (let i = 0; i < maxCols; i++) {
          widths.forEach(width => {
            if (width.length > i) {
              maxWidths[i] = Math.max(maxWidths[i], width[i]);
            }
          });
        }
        // Convert to a dict so we can use .get()
        // maxWidths = dict(enumerate(maxWidths))

        // Minimum spaces between line columns
        const minColSpaces = ' '.repeat(config.get('min_spaces_between_columns'));
        // format the spacing of columns, but ignore the author tag. (See #197)
        out = out.map(line => line.startsWith('@') && !line.startsWith('@author')
          ? line.split(' ').flatMap((word, index) => [
            word,
            minColSpaces + ' '.repeat(Math.max(0, maxWidths[index] - outputWidth(word)))
          ]).join('').trim()
          : line);
      }

      // fix all the tab stops so they're consecutive
      let counter = 0;
      const swapTabs = (match, group1, group2, str) => `${group1}${counter++}${group2}`;
      out = out.map(line => line.replace(/(\$\{)\d+(:[^}]+\})/g, swapTabs));

      if (inline) {
        snippet = ` ${out[0]} */`;
      } else {
        const regex = /^\s*@([a-zA-Z]+)/;
        if (config.get('spacer_between_sections') === 'true') {
          let lastTag = null;
          out = out.flatMap(line => {
            const match = regex.exec(line);
            if (match && lastTag !== match[1]) {
              lastTag = match[1];
              return ['', line];
            }
            return line;
          });
        } else if (config.get('spacer_between_sections') !== 'false') {
          let lastLineIsTag = false;
          out = out.flatMap(line => {
            if (regex.exec(line)) {
              if (!lastLineIsTag) {
                lastLineIsTag = true;
                return ['', line];
              }
            }
            return line;
          });
        }
        const prefix = parser.settings.prefix ?? ' *';
        snippet = out.reduce((snippet, line) =>
          `${snippet}\n${prefix}${line ? `${indentSpaces}${line}` : ''}`, '');

        if (parser.settings.commentType === 'block') {
          snippet += `\n${parser.settings.commentCloser}`;
        }

        if (config.get('newline_after_block')) {
          snippet += '\n';
        }
      }
    } else {
      if (inline) {
        snippet = ' $0 */';
      } else {
        return this.parseBlockCommand(event);
      }
    }

    this.write(event, snippet);
  }

  /**
   * Perform actions for a single-asterix block comment
   */
  static parseBlockCommand (event) {
    const editor = event.currentTarget.getModel();

    const { row, column } = editor.getCursorBufferPosition(); // will handle only one instance
    // Get trailing string
    const lineLength = editor.lineTextForBufferRow(row).length;
    const trailingRange = [[row, column], [row, lineLength]];
    let trailingString = editor.getTextInBufferRange(trailingRange);
    // drop trailing */
    trailingString = trailingString.replace(/\s*\*\/\s*$/, '');
    trailingString = escape(trailingString);

    const indentSpaces = ' '.repeat(config.get('indentation_spaces'));

    // read the next line
    const line = editor.lineTextForBufferRow(row + 1);

    // Remove trailing characters (will write them appropriately later)
    editor.getBuffer().delete(trailingRange);

    // Build the string to write
    let string = '\n';

    // Might include asterixes
    if (config.get('c_style_block_comments')) {
      string += ' *' + indentSpaces;
    }

    // Write indentation and trailing characters. Select trailing characters
    string += `\${0:${trailingString}}`;

    // Close if needed
    if (!this.parser.isExistingComment(line)) {
      string += '\n */';
    }

    this.write(event, string);
  }

  static trimAutoWhitespaceCommand (event) {
    /**
     * Trim the automatic whitespace added when creating a new line in a docblock.
     */
    const editor = event.currentTarget.getModel();

    const cursorPosition = editor.getCursorBufferPosition();
    let lineText = editor.lineTextForBufferRow(cursorPosition.row);
    const lineLength = editor.lineTextForBufferRow(cursorPosition.row).length;
    const spaces = config.get('indentation_spaces');

    const regex = /^(\s*\*)\s*$/;
    lineText = lineText.replace(regex, '$1\n$1' + ' '.repeat(spaces));
    const range = [[cursorPosition.row, 0], [cursorPosition.row, lineLength]];
    editor.setTextInBufferRange(range, lineText);
  }

  /**
   * Try to append indentation to bring the cursor in line with above
   * documentation comment description segment.
   * @param {Event} event Atom command event
   */
  static indentCommand (event) {
    const editor = event.currentTarget.getModel();
    const { row, column } = editor.getCursorBufferPosition();
    const line = editor.lineTextForBufferRow(row - 1);
    // Regular expressions that should match all cases where indentation can occur
    const regexps = [
      /^(\s*\*|\/\/\/)(\s*@(?:param|property)\s+\S+\s+)(\S+\s+)?\S/,
      /^(\s*\*|\/\/\/)(\s*@(?:returns?|define)\s+)(\S+\s+)?\S/,
      /^(\s*\*|\/\/\/)(\s*@[a-z]+\s+)\S/,
      /^(\s*\*|\/\/\/)(\s*)/
    ];

    for (const regexp of regexps) {
      const matches = regexp.exec(line) ?? [];
      const [, toStar, toDescription, extraIndent] = matches.map(({ length }) => length);

      let toInsert = toDescription - column + toStar;

      if (this.parser?.settings?.typeInfo) {
        toInsert += extraIndent;
      }

      if (toInsert > 0) {
        editor.insertText(' '.repeat(toInsert));
        return;
      }
    }

    event.abortKeyBinding();
  }

  static joinCommand (event) {
    const editor = event.currentTarget.getModel();

    const selections = editor.getSelections();
    let i, j, rowBegin;
    const textWithEnding = row => editor.buffer.lineForRow(row) + editor.buffer.lineEndingForRow(row);

    for (i = 0; i < selections.length; i++) {
      const selection = selections[i];
      let noRows;
      const _r = selection.getBufferRowRange();
      noRows = Math.abs(_r[0] - _r[1]); // no of rows in selection
      rowBegin = Math.min(_r[0], _r[1]);
      if (noRows === 0) {
        // exit if current line is the last one
        if ((_r[0] + 1) === editor.getLastBufferRow()) { continue; }
        noRows = 2;
      } else { noRows += 1; }

      let text = '';
      for (j = 0; j < noRows; j++) {
        text += textWithEnding(rowBegin + j);
      }
      const regex = /[ \t]*\n[ \t]*((?:\*|\/\/[!/]?|#)[ \t]*)?/g;
      text = text.replace(regex, ' ');
      const endLineLength = editor.lineTextForBufferRow(rowBegin + noRows - 1).length;
      const range = [[rowBegin, 0], [rowBegin + noRows - 1, endLineLength]];
      editor.setTextInBufferRange(range, text);
    }
  }

  static decorateCommand (event) {
    const editor = event.currentTarget.getModel();

    const pos = editor.getCursorBufferPosition();
    const whitespaceRe = /^(\s*)\/\//;
    const scopeRange = this.scopeRange(editor, pos, 'comment.line.double-slash');

    let maxLen = 0;
    let _i, leadingWs, lineText, tabCount;
    const _row = scopeRange[0].row;
    const _len = Math.abs(scopeRange[0].row - scopeRange[1].row);

    for (_i = 0; _i <= _len; _i++) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      tabCount = lineText.split('\t').length - 1;

      const matches = whitespaceRe.exec(lineText);
      if (matches[1] == null) { leadingWs = 0; } else { leadingWs = matches[1].length; }

      leadingWs -= tabCount;
      maxLen = Math.max(maxLen, editor.lineTextForBufferRow(_row + _i).length);
    }

    const lineLength = maxLen - leadingWs;
    leadingWs = '\t'.repeat(tabCount) + ' '.repeat(leadingWs);
    editor.buffer.insert(scopeRange[1], '\n' + leadingWs + '/'.repeat(lineLength + 3) + '\n');

    for (_i = _len; _i >= 0; _i--) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      const _length = editor.lineTextForBufferRow(_row + _i).length;
      const rPadding = 1 + (maxLen - _length);
      const _range = [[scopeRange[0].row + _i, 0], [scopeRange[0].row + _i, _length]];
      editor.setTextInBufferRange(_range, leadingWs + lineText + ' '.repeat(rPadding) + '//');
    }
    editor.buffer.insert(scopeRange[0], '/'.repeat(lineLength + 3) + '\n');
  }

  static decorateMultilineCommand (event) {
    const editor = event.currentTarget.getModel();

    const pos = editor.getCursorBufferPosition();
    const whitespaceRe = /^(\s*)\/\*/;
    const tabSize = config.get('editor.tabLength');
    const scopeRange = this.scopeRange(editor, pos, 'comment.block');
    const lineLengths = {};

    let maxLen = 0;
    let _i, blockWs, lineText, contentTabCount;
    const _row = scopeRange[0].row;
    const _len = Math.abs(scopeRange[0].row - scopeRange[1].row);

    // get block indent from first line
    lineText = editor.lineTextForBufferRow(_row);
    const blockTabCount = lineText.split('\t').length - 1;
    const matches = whitespaceRe.exec(lineText);
    if (matches == null) { blockWs = 0; } else { blockWs = matches[1].length; }
    blockWs -= blockTabCount;

    // get maxLen
    for (_i = 1; _i < _len; _i++) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      const textLength = lineText.length;
      contentTabCount = lineText.split('\t').length - 1;
      lineLengths[_i] = textLength - contentTabCount + (contentTabCount * tabSize);
      maxLen = Math.max(maxLen, lineLengths[_i]);
    }

    const lineLength = maxLen - blockWs;
    blockWs = '\t'.repeat(blockTabCount) + ' '.repeat(blockWs);

    // last line
    lineText = editor.lineTextForBufferRow(scopeRange[1].row);
    lineText = lineText.replace(/^(\s*)(\*)+\//, (match, p1, stars) =>
      (p1 + '*'.repeat(lineLength + 2 - stars.length) + '/' + '\n'));
    let _range = [[scopeRange[1].row, 0], [scopeRange[1].row, lineLength]];
    editor.setTextInBufferRange(_range, lineText);

    // first line
    lineText = editor.lineTextForBufferRow(scopeRange[0].row);
    lineText = lineText.replace(/^(\s*)\/(\*)+/, (match, p1, stars) =>
      (p1 + '/' + '*'.repeat(lineLength + 2 - stars.length)));
    _range = [[scopeRange[0].row, 0], [scopeRange[0].row, lineLength]];
    editor.setTextInBufferRange(_range, lineText);

    // skip first line and last line
    for (_i = _len - 1; _i > 0; _i--) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      const _length = editor.lineTextForBufferRow(_row + _i).length;
      const rPadding = 1 + (maxLen - lineLengths[_i]);
      _range = [[scopeRange[0].row + _i, 0], [scopeRange[0].row + _i, _length]];
      editor.setTextInBufferRange(_range, lineText + ' '.repeat(rPadding) + '*');
    }
  }

  static deindentCommand (event) {
    /*
       * When pressing enter at the end of a docblock, this takes the cursor back one space.
      /**
       *
       *//* |   <-- from here
      |      <-- to here
       */
    const editor = event.currentTarget.getModel();
    const cursor = editor.getCursorBufferPosition();
    let text = editor.lineTextForBufferRow(cursor.row);
    text = text.replace(/^(\s*)\s\*\/.*/, '\n$1');
    editor.insertText(text, { autoIndentNewline: false });
  }

  static reparseCommand (event) {
    // Reparse a docblock to make the fields 'active' again, so that pressing tab will jump to the next one
    const editor = event.currentTarget.getModel();
    const pos = editor.getCursorBufferPosition();
    let counter = 0;
    // const Snippets = atom.packages.activePackages.snippets.mainModule;
    // disable all snippet expansions

    if (editor.snippetExpansion != null) { editor.snippetExpansion.destroy(); }
    const scopeRange = this.scopeRange(editor, pos, 'comment.block');
    let text = editor.getTextInBufferRange([scopeRange[0], scopeRange[1]]);
    // escape string, so variables starting with $ won't be removed
    text = escape(text);
    // strip out leading spaces, since inserting a snippet keeps the indentation
    text = text.replace(/\n\s+\*/g, '\n *');
    // replace [bracketed] [text] with a tabstop
    text = text.replace(/(\[.+?\])/g, (m, g1) => `\${${counter++}:${g1}}`);

    editor.buffer.delete(([scopeRange[0], scopeRange[1]]));
    editor.setCursorBufferPosition(scopeRange[0]);
    if ((text.search(/\${0:/) < 0) && (text.search(/\$0/) < 0)) { text += '$0'; }
    this.write(event, text);
  }

  static wrapLinesCommand (event) {
    /**
     * Reformat description text inside a comment block to wrap at the correct length.
     * Wrap column is set by the first ruler (set in Default.sublime-settings), or 80 by default.
     * Shortcut Key: alt+q
     */
    const editor = event.currentTarget.getModel();
    const pos = editor.getCursorBufferPosition();
    // const tabSize = config.get('editor.tabLength');
    const wrapLen = config.get('editor.preferredLineLength');

    const numIndentSpaces = config.get('indentation_spaces');
    const indentSpaces = ' '.repeat(numIndentSpaces);
    const indentSpacesSamePara = ' '.repeat(config.get('indentation_spaces_same_para'));
    const spacerBetweenSections = (config.get('spacer_between_sections') === 'true');
    const spacerBetweenDescTags = (config.get('spacer_between_sections') !== 'false');

    const scopeRange = this.scopeRange(editor, pos, 'comment.block');
    // const text = editor.getTextInBufferRange([scopeRange[0], scopeRange[1]]);

    // find the first word
    let i, len, _col, _text;
    const startPoint = {};
    const endPoint = {};
    const startRow = scopeRange[0].row;
    len = Math.abs(scopeRange[0].row - scopeRange[1].row);
    for (i = 0; i <= len; i++) {
      _text = editor.lineTextForBufferRow(startRow + i);
      _col = _text.search(/^\s*\* /);
      if (_col > -1) {
        if (i === 0) {
          startPoint.column = scopeRange[0].column + _col;
        } else {
          startPoint.column = _col;
        }
        startPoint.row = scopeRange[0].row + i;
        break;
      }
    }
    // find the first tag, or the end of the comment
    for (i = 0; i <= len; i++) {
      _text = editor.lineTextForBufferRow(startRow + i);
      _col = _text.search(/^\s*\*(\/)/);
      if (_col > -1) {
        if (i === 0) {
          endPoint.column = scopeRange[0].column + _col;
        } else {
          endPoint.column = _col;
        }
        endPoint.row = scopeRange[0].row + i;
        break;
      }
    }
    let text = editor.getTextInBufferRange([startPoint, endPoint]);

    // find the indentation level
    const regex = /(\s*\*)/;
    const matches = regex.exec(text);
    // const indentation = matches[1].replace(/\t/g, ' '.repeat(tabSize)).length;
    const linePrefix = matches[1];

    // join all the lines, collapsing "empty" lines
    text = text.replace(/\n(\s*\*\s*\n)+/g, '\n\n');

    const wrapPara = para => {
      para = para.replace(/(\n|^)\s*\*\s*/g, ' ');
      let _i;
      // split the paragraph into words
      const words = para.trim().split(' ');
      let text = '\n';
      let line = linePrefix + indentSpaces;
      let lineTagged = false; // indicates if the line contains a doc tag
      let paraTagged = false; // indicates if this paragraph contains a doc tag
      let lineIsNew = true;
      let tag = '';
      // join all words to create lines, no longer than wrapLength
      for (_i = 0; _i < words.length; _i++) {
        const word = words[_i];
        if ((word == null) && (!lineTagged)) { continue; }

        if ((lineIsNew) && (word[0] === '@')) {
          lineTagged = true;
          paraTagged = true;
          tag = word;
        }

        if ((line.length + word.length) > wrapLen) {
          // appending the word to the current line would exceed its
          // length requirements
          text += line.replace(/\s+$/, '') + '\n';
          line = linePrefix + indentSpacesSamePara + word + ' ';
          lineTagged = false;
          lineIsNew = true;
        } else {
          line += word + ' ';
        }
        lineIsNew = false;
      }
      text += line.replace(/\s+$/, '');

      return {
        text: text,
        lineTagged: lineTagged,
        tagged: paraTagged,
        tag: tag
      };
    };

    // split the text into paragraphs, where each paragraph is eighter
    // defined by an empty line or the start of a doc parameter
    const paragraphs = text.split(/\n{2,}|\n\s*\*\s*(?=@)/);
    const wrappedParas = [];
    text = '';
    for (i = 0; i < paragraphs.length; i++) {
      // wrap the lines in the current paragraph
      wrappedParas.push(wrapPara(paragraphs[i]));
    }

    // combine all the paragraphs into a single piece of text
    for (i = 0; i < (len = wrappedParas.length); i++) {
      const para = wrappedParas[i];
      const last = (i === (wrappedParas.length - 1));
      let _tag, _tagged;
      if (i === len - 1) {
        _tag = _tagged = false;
      } else {
        _tag = wrappedParas[i + 1].tag;
        _tagged = wrappedParas[i + 1].tagged;
      }
      const nextIsTagged = (!last && _tagged);
      const nextIsSameTag = ((nextIsTagged && para.tag) === _tag);

      if (last || ((para.lineTagged || nextIsTagged) && !(spacerBetweenSections && (!nextIsSameTag)) && !((!para.lineTagged) && nextIsTagged && spacerBetweenDescTags))) {
        text += para.text;
      } else {
        text += para.text + '\n' + linePrefix;
      }
    }
    text = escape(text);
    // strip start \n
    if (text.search(/^\n/) > -1) { text = text.replace(/^\n/, ''); }
    // add end \n
    if (text.search(/\n$/) < 0) { text += '\n'; }
    editor.setTextInBufferRange([startPoint, endPoint], text);
  }

  static write (event, string) {
    // will insert data at last cursor position
    DocBlockrAtom.snippets?.insertSnippet(string, event.currentTarget.getModel()) ??
    event.abortKeyBinding();
  }

  static scopeRange (editor, point, scopeName) {
    // find scope starting point
    // checks: ends when row less than zero, column != 0
    // check if current point is valid
    let _range;
    if ((_range = editor.bufferRangeForScopeAtPosition(scopeName, point)) == null) { return null; }

    let start, end;
    let _row = point.row;
    let lineLength;
    start = _range.start;
    end = _range.end;
    while (_row >= 0) {
      lineLength = editor.lineTextForBufferRow(_row).length;
      _range = editor.bufferRangeForScopeAtPosition(scopeName, [_row, lineLength]);
      if (_range == null) { break; }
      start = _range.start;
      if (start.column > 0) {
        break;
      }
      _row--;
    }
    _row = point.row;
    const lastRow = editor.getLastBufferRow();
    while (_row <= lastRow) {
      lineLength = editor.lineTextForBufferRow(_row).length;
      _range = editor.bufferRangeForScopeAtPosition(scopeName, [_row, 0]);
      if (_range == null) { break; }
      end = _range.end;
      if (end.column < lineLength) {
        break;
      }
      _row++;
    }
    return [start, end];
  }
};
