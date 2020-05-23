const { CompositeDisposable } = require('atom');

const DocsParser = require('./docsparser');
const { escape, config } = require('./utils');
const util = require('util');
const Docblock = require('./Docblock');

const test = {
  template: [
    ['\n[', 'description]', ''],
    ['@name', '@param', '@returns']
  ],
  placeholders: {
    get date () { return [[(new Date()).toISOString().replace(/T.*/, '')]]; },
    get datetime () { return (new Date()).toISOString().replace(/Z$/, ''); },
    spacer: [['\t']],
    br: [['\n']],
    name: [
      ['', ' '],
      ['identifier']
    ],
    param: [
      ['\n * ', '\t{', '}\t', '', '', '\t[description]\n'],
      ['tag', '=type', '[type]', '&value', '[', 'identifier', '&value', [['=', ']'], ['value']]]
    ],
    returns: [
      ['\n * ', '\t{', '}\t[description]\n'],
      ['tag', '=type', '[type]']
    ]
  }
};

let docblockr;
class Docblockr {
  static get config () {
    return {
      template: {
        description: '',
        type: 'string',
        default: '`br´[`@name´description]`br´`@param``bol´´``eol´´´`br´`@returns``bol´´``eol´´´`br´'
      },
      placeholders: {
        type: 'object',
        default: {
          name: '`identifier´ ',
          param: '`tag´`spacer´{`=type`[type]´´}`spacer´`?value`[´´`identifier´`?value`=`value´]´´',
          returns: '',
          bol: ' * ',
          eol: '`spacer´[description]'
        }
      },
      notations: {
        description: 'Patterns used to guess types of variables, function return values, etc.',
        type: 'object',
        default: DocsParser.notation.map
        // Can't really enforce correct format, as type names can be anything
      }
    };
  }

  static placeholder (string = test.template) {
    if (test.placeholders[string]) {
      return Docblockr.placeholder(test.placeholders[string] instanceof Function
        ? test.placeholders[string]()
        : test.placeholders[string]);
    }

    const result = [...string].reduce((template, char) => {
      switch (char) {
        case '`':
          if (template.hold != null) {
            template.hold++;
            if (template.hold === 1) {
              template.push('');
            }
          } else {
            template.hold = 1;
          }
          if (template.hold > 1) {
            template[template.length - 1] += char;
          }
          break;
        case '´':
          if (template.hold) {
            template.hold--;
            if (template.hold === 0) {
              template.push('');
            } else {
              template[template.length - 1] += char;
            }
          }
          break;
        default:
          template[template.length - 1] += char;
      }
      return template;
    }, ['']);
    return result.length > 1
      ? result.map(string => Docblockr.placeholder(string))
      : result[0];
  }

  static activate () {
    docblockr = new Docblockr();

    const dothing = ([template, placeholders = []] = test.template, blocks) => {
      console.log(template)
      return String.raw({
        raw: template
      }, ...placeholders.flatMap(placeholder => {
        if (!test.placeholders[placeholder]) {
          const [char] = placeholder;
          switch (char) {
            case '@':
            default:
              placeholder = placeholder.substring(1);
          }
        }
        return dothing(test.placeholders[placeholder]);
      }));
    };

    console.log(dothing())

    Docblockr.deactivate = (new CompositeDisposable(
      atom.commands.add('atom-text-editor', 'docblockr:parse-tab', event => {
        if (docblockr.validateRequest({ preceding: /^\s*(\/\*([*!])|###\*|\/\/\*)\s*$/ })) {
          // Parse Command
          docblockr.parseCommand(event, false);
        } else if (docblockr.validateRequest({ preceding: /^(\s*\*|\/\/\/)\s*$/ })) {
          // Indent Command
          docblockr.indentCommand(event);
        } else {
          event.abortKeyBinding();
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:parse-enter', event => {
        if (Docblockr.document()) {
        } else if (docblockr.validateRequest({ preceding: /^\s*(\/\*([*!])|###\*|\/\/\*)\s*$/ })) {
          // Parse Command
          docblockr.parseCommand(event, false);
        } else if (docblockr.validateRequest({ preceding: /^\s*\*\s*$/, following: /^\s*$/, scope: 'comment.block' })) {
          // Trim auto whitespace
          docblockr.trimAutoWhitespaceCommand(event);
        } else if (docblockr.validateRequest({ preceding: /^\s+\*\// })) {
          // Deindent command
          docblockr.deindentCommand(event);
        } else if (docblockr.validateRequest({ preceding: /^\s*\/\*$/, following: /^\*\/\s*$/ })) {
          // Snippet-1 command
          docblockr.write(event, '\n$0\n ');
        } else if (Docblockr.comment()) {
        } else if ((config.get('extend_double_slash') === true) && (docblockr.validateRequest({ preceding: /^\s*(\/\/[/!]?|#)/, scope: 'comment.line' }))) {
          // Extend line comments (// and #)
          const _regex = /^(\s*[^\sa-z0-9]*\s*).*$/;
          const editor = event.target.closest('atom-text-editor').getModel();
          const cursorPosition = editor.getCursorBufferPosition();
          let lineText = editor.lineTextForBufferRow(cursorPosition.row);
          lineText = lineText.replace(_regex, '$1');
          editor.insertText('\n' + lineText);
        } else {
          event.abortKeyBinding();
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:parse-inline', event => {
        // console.log('Parse-Inline command');
        if (docblockr.validateRequest({ preceding: /^\s*\/\*{2}$/ })) {
          docblockr.parseCommand(event, true);
        } else {
          const editor = event.target.closest('atom-text-editor').getModel();
          editor.insertNewline();
          // event.abortKeyBinding();
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:comment', event => {
        Docblockr.matchComment() ||
        event.abortKeyBinding();
      }),
      atom.commands.add('atom-text-editor', 'docblockr:join', event => {
        // console.log('Join command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.joinCommand(event);
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:reparse', event => {
        // console.log('Reparse command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.reparseCommand(event);
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:wrap-lines', event => {
        // console.log('Wraplines command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.wrapLinesCommand(event);
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:decorate', event => {
        // console.log('Decorate command');
        if (docblockr.validateRequest({ scope: 'comment.line' })) {
          docblockr.decorateCommand(event);
        }
      }),
      atom.commands.add('atom-text-editor', 'docblockr:decorate-multiline', event => {
        // console.log('Decorate Multiline command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.decorateMultilineCommand(event);
        }
      })
    )).dispose;
  }

  static consumeSnippetsService (service) {
    Docblockr.snippetsService = service;
    return { dispose: () => (Docblockr.snippetsService = null) };
  }

  // TODO: Make 'DocBlockrAtom.snippets' private
  static get snippetsService () {
    if (!Docblockr.snippets) {
      atom.notifications.addError('Docblockr: Missing Snippets service.', {
        description: 'Please ensure the Snippets package is enabled.',
        dismissable: true
      });
    }
    return Docblockr.snippets;
  }

  static set snippetsService (service) {
    Docblockr.snippets = service;
  }

  // TODO: Use optional chaining
  static write (cursor, snippet) {
    return Docblockr.snippetsService
      ? Docblockr.snippetsService.insertSnippet(snippet, null, cursor)
      : false;
  }

  /**
   * Automatically appends a closer to a comment block start
   * @return {Boolean} Whether the command consumed all matching cursors
   * @todo   Add support for additional block comment types (cleanly (somehow))
   *         (preferably without using an InsertText event listener)
   */
  static matchComment () {
    const cursors = Docblockr.matchingCursors(/\/$/);
    return cursors.length && cursors.every(cursor => {
      const { row, column } = cursor.getBufferPosition();
      const text = cursor.getCurrentBufferLine();
      // Use transact, so the changes can be undone with a single command
      return cursor.editor.buffer.transact(() => {
        // Remove all text on row after and including the forward slash
        cursor.editor.buffer.delete([[row, column - 1], [row, Infinity]]);
        // Insert the comment as a snippet that has any trailing text selected
        return Docblockr.write(cursor, `/*\${1: ${text.slice(column)}} */$0`);
      });
    });
  }

  // TODO: remove once transition to 'getMatchingCursor' is complete
  validateRequest ({ scope, preceding, following }) {
    const cursors = atom.workspace.getActiveTextEditor().getCursors();
    const targetCursor = Docblockr.matchingCursors(preceding, following, scope).pop();
    // If a matching cursor was found, remove all other cursors and return true
    return targetCursor
      ? cursors.every(cursor => cursor === targetCursor || !cursor.destroy())
      : false;
  }

  /**
   * Get all Cursors that match the given scope and regular expressions
   * @param  {RegExp} [preceding=/(?:)/] RegExp to check preceding text against
   * @param  {RegExp} [following=/(?:)/] RegExp to check following text against
   * @param  {String} [scope='']         Scope descriptor to check for
   * @return {Array<Cursor>} An array of mathcing Cursors, if any
   */
  static matchingCursors (preceding = /(?:)/, following = /(?:)/, scope = '') {
    return atom.workspace.getActiveTextEditor().getCursors().filter(cursor => {
      const scopes = cursor.getScopeDescriptor().getScopesArray();
      // `String.prototype.includes` as there's no strict syntax for scope names
      if (scopes.some(cursorScope => cursorScope.includes(scope))) {
        const text = cursor.getCurrentBufferLine();
        const column = cursor.getBufferColumn();
        return preceding.test(text.slice(0, column)) && following.test(text.slice(column));
      }
    });
  }

  /**
   * Checks whether given Cursor is followed by a comment block
   * @param  {Cursor} cursor Cursor to check around
   * @return {Boolean} Whether next line is inside a comment block or not
   */
  static insideCommentBlock (cursor) {
    const row = cursor.getBufferRow();
    const scopes = cursor.editor.scopeDescriptorForBufferPosition([row + 1]);
    return scopes.getScopesArray().some(scope => scope.includes('comment.block'));
  }

  /**
   * Expands comment blocks to the next line
   * @param  {Array<Cursor>} [cursors=matchingCursors()] Cursors to process
   * @return {Boolean}       Whether the command consumed all matching cursors
   */
  static comment (cursors = Docblockr.matchingCursors(/(?:)/, /(?:)/, 'comment.block')) {
    return cursors.length && cursors.every(cursor => {
      const { row, column } = cursor.getBufferPosition();
      const text = cursor.getCurrentBufferLine();
      // Add space only if on the first line, as snippets also does indenting
      let snippet = `\n${/^\s*\/\*\s*$/.test(text.slice(0, column)) ? ' ' : ''}`;
      if (config.get('c_style_block_comments')) {
        snippet += `*${' '.repeat(config.get('indentation_spaces'))}`;
      }
      // Moves trailing comment closer to its own line, if it exists
      snippet += `$0${text.slice(column).replace(/(\*\/)/, '\n $1')}`;
      // Use transact, so the changes can be undone with a single command
      return cursor.editor.buffer.transact(() => {
        // Remove all text on row after the cursor
        cursor.editor.buffer.delete([[row, column], [row, Infinity]]);
        // Insert the comment as a snippet that has any trailing text selected
        return Docblockr.write(cursor, snippet);
      });
    });
  }

  static document (inline = false, cursors = Docblockr.matchingCursors(/^\s*\/\*\*/, /\*\//, 'comment.block')) {
    return cursors.length && cursors.every(cursor => {
      const Parser = Docblockr.parsers[cursor.editor.getGrammar().scopeName];

      const row = cursor.getBufferRow();
      const position = { row, column: Infinity };

      const [node] = cursor.editor.languageMode.tree.rootNode.descendantsOfType(Parser.entryTypes, position);
      console.log(Parser.document([node], new Map(Parser.pattern)));
    });
  }

  parseCommand (event, inline, cursors = Docblockr.matchingCursors(/(?:)/, /(?:)/, 'comment.block')) {
    const editor = event.target.closest('atom-text-editor').getModel();
    if (typeof editor === 'undefined' || editor === null) {
      return;
    }
    inline = (typeof inline === 'undefined') ? false : inline;
    let cursorPosition = editor.getCursorBufferPosition(); // will handle only one instance
    // Get trailing string
    const lineLength = editor.lineTextForBufferRow(cursorPosition.row).length;
    const trailingRange = [cursorPosition, [cursorPosition.row, lineLength]];
    let trailingString = editor.getTextInBufferRange(trailingRange);
    // drop trailing */
    trailingString = trailingString.replace(/\s*\*\/\s*$/, '');
    trailingString = escape(trailingString);

    const Parser = Docblockr.parsers[editor.getGrammar().scopeName];
    const parser = new Parser();

    const indentSpaces = this.repeat(' ', Math.max(0, (config.get('indentation_spaces') || 1)));

    // read the next line
    cursorPosition = cursorPosition.copy();
    cursorPosition.row += 1;
    const line = parser.getDefinition(editor, cursorPosition, this.readLine);
    if (Docblockr.insideCommentBlock(editor.getLastCursor())) {
      this.write(event, '\n *' + indentSpaces);
      return;
    }

    // erase characters in the view (will be added to the output later)
    this.erase(editor, trailingRange);

    // match against a function declaration and use trailing string as a description of the function
    const out = parser.parse(line, inline, trailingString);
    let snippet = this.generateSnippet(out, inline, parser);
    // atom doesnt currently support, snippet end by default
    // so add $0
    if ((snippet.search(/\${0:/) < 0) && (snippet.search(/\$0/) < 0)) { snippet += '$0'; }
    this.write(event, snippet);
  }

  trimAutoWhitespaceCommand (event) {
    /**
     * Trim the automatic whitespace added when creating a new line in a docblock.
     */
    const editor = event.target.closest('atom-text-editor').getModel();
    if (typeof editor === 'undefined' || editor === null) {
      return;
    }
    const cursorPosition = editor.getCursorBufferPosition();
    let lineText = editor.lineTextForBufferRow(cursorPosition.row);
    const lineLength = editor.lineTextForBufferRow(cursorPosition.row).length;
    const spaces = Math.max(0, config.get('indentation_spaces'));

    const regex = /^(\s*\*)\s*$/;
    lineText = lineText.replace(regex, ('$1\n$1' + this.repeat(' ', spaces)));
    const range = [[cursorPosition.row, 0], [cursorPosition.row, lineLength]];
    editor.setTextInBufferRange(range, lineText);
  }

  indentCommand (event) {
    const editor = event.target.closest('atom-text-editor').getModel();
    const currentPos = editor.getCursorBufferPosition();
    const prevLine = editor.lineTextForBufferRow(currentPos.row - 1);
    const spaces = this.getIndentSpaces(editor, prevLine);

    if (spaces !== null) {
      const matches = /^(\s*(?:\*|\/\/\/))/.exec(prevLine);
      const toStar = matches[1].length;
      const toInsert = spaces - currentPos.column + toStar;
      if (toInsert > 0) {
        editor.insertText(this.repeat(' ', toInsert));
      }
      return;
    }
    event.abortKeyBinding();
  }

  joinCommand (event) {
    const editor = event.target.closest('atom-text-editor').getModel();
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

  decorateCommand (event) {
    const editor = event.target.closest('atom-text-editor').getModel();
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
    leadingWs = this.repeat('\t', tabCount) + this.repeat(' ', leadingWs);
    editor.buffer.insert(scopeRange[1], '\n' + leadingWs + this.repeat('/', (lineLength + 3)) + '\n');

    for (_i = _len; _i >= 0; _i--) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      const _length = editor.lineTextForBufferRow(_row + _i).length;
      const rPadding = 1 + (maxLen - _length);
      const _range = [[scopeRange[0].row + _i, 0], [scopeRange[0].row + _i, _length]];
      editor.setTextInBufferRange(_range, leadingWs + lineText + this.repeat(' ', rPadding) + '//');
    }
    editor.buffer.insert(scopeRange[0], this.repeat('/', lineLength + 3) + '\n');
  }

  decorateMultilineCommand (event) {
    const editor = event.target.closest('atom-text-editor').getModel();
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
    blockWs = this.repeat('\t', blockTabCount) + this.repeat(' ', blockWs);

    // last line
    lineText = editor.lineTextForBufferRow(scopeRange[1].row);
    lineText = lineText.replace(/^(\s*)(\*)+\//, (match, p1, stars) =>
      (p1 + this.repeat('*', (lineLength + 2 - stars.length)) + '/' + '\n'));
    let _range = [[scopeRange[1].row, 0], [scopeRange[1].row, lineLength]];
    editor.setTextInBufferRange(_range, lineText);

    // first line
    lineText = editor.lineTextForBufferRow(scopeRange[0].row);
    lineText = lineText.replace(/^(\s*)\/(\*)+/, (match, p1, stars) =>
      (p1 + '/' + this.repeat('*', (lineLength + 2 - stars.length))));
    _range = [[scopeRange[0].row, 0], [scopeRange[0].row, lineLength]];
    editor.setTextInBufferRange(_range, lineText);

    // skip first line and last line
    for (_i = _len - 1; _i > 0; _i--) {
      lineText = editor.lineTextForBufferRow(_row + _i);
      const _length = editor.lineTextForBufferRow(_row + _i).length;
      const rPadding = 1 + (maxLen - lineLengths[_i]);
      _range = [[scopeRange[0].row + _i, 0], [scopeRange[0].row + _i, _length]];
      editor.setTextInBufferRange(_range, lineText + this.repeat(' ', rPadding) + '*');
    }
  }

  deindentCommand (event) {
    /*
       * When pressing enter at the end of a docblock, this takes the cursor back one space.
      /**
       *
       *//* |   <-- from here
      |      <-- to here
       */
    const editor = event.target.closest('atom-text-editor').getModel();
    const cursor = editor.getCursorBufferPosition();
    let text = editor.lineTextForBufferRow(cursor.row);
    text = text.replace(/^(\s*)\s\*\/.*/, '\n$1');
    editor.insertText(text, { autoIndentNewline: false });
  }

  reparseCommand (event) {
    // Reparse a docblock to make the fields 'active' again, so that pressing tab will jump to the next one
    const tabIndex = this.counter();
    const editor = event.target.closest('atom-text-editor').getModel();
    const pos = editor.getCursorBufferPosition();
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
    text = text.replace(/(\[.+?\])/g, (m, g1) => `\${${tabIndex()}:${g1}}`);

    editor.buffer.delete(([scopeRange[0], scopeRange[1]]));
    editor.setCursorBufferPosition(scopeRange[0]);
    if ((text.search(/\${0:/) < 0) && (text.search(/\$0/) < 0)) { text += '$0'; }
    this.write(event, text);
  }

  wrapLinesCommand (event) {
    /**
     * Reformat description text inside a comment block to wrap at the correct length.
     * Wrap column is set by the first ruler (set in Default.sublime-settings), or 80 by default.
     * Shortcut Key: alt+q
     */
    const editor = event.target.closest('atom-text-editor').getModel();
    const pos = editor.getCursorBufferPosition();
    // const tabSize = config.get('.get('editor.tabLength');
    const wrapLen = config.get('editor.preferredLineLength');

    const numIndentSpaces = Math.max(0, (config.get('indentation_spaces') ? config.get('indentation_spaces') : 1));
    const indentSpaces = this.repeat(' ', numIndentSpaces);
    const indentSpacesSamePara = this.repeat(' ', (config.get('indentation_spaces_same_para') ? config.get('indentation_spaces_same_para') : numIndentSpaces));
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
    // const indentation = matches[1].replace(/\t/g, this.repeat(' ', tabSize)).length;
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

  getIndentSpaces (editor, line) {
    const hasTypes = (new Docblockr.parsers[editor.getGrammar().scopeName]()).settings.typeInfo;
    const extraIndent = ((hasTypes === true) ? '\\s+\\S+' : '');

    const regex = [
      new RegExp(util.format('^\\s*(\\*|\\/\\/\\/)(\\s*@(?:param|property)%s\\s+\\S+\\s+)\\S', extraIndent)),
      new RegExp(util.format('^\\s*(\\*|\\/\\/\\/)(\\s*@(?:returns?|define)%s\\s+\\S+\\s+)\\S', extraIndent)),
      new RegExp('^\\s*(\\*|\\/\\/\\/)(\\s*@[a-z]+\\s+)\\S'),
      new RegExp('^\\s*(\\*|\\/\\/\\/)(\\s*)')
    ];

    let i, matches;
    for (i = 0; i < regex.length; i++) {
      matches = regex[i].exec(line);
      if (matches != null) { return matches[1].length; }
    }
    return null;
  }

  counter () {
    let count = 0;
    return () => ++count;
  }

  repeat (string, number) {
    return Array(Math.max(0, number) + 1).join(string);
  }

  write (event, str) {
    const cursor = event.target.closest('atom-text-editor').getModel().getLastCursor();
    Docblockr.write(cursor, str) || event.abortKeyBinding();
  }

  erase (editor, range) {
    const buffer = editor.getBuffer();
    buffer.delete(range);
  }

  fillArray (len) {
    const a = [];
    let i = 0;
    while (i < len) {
      a[i] = 0;
      i++;
    }
    return a;
  }

  readLine (editor, point) {
    // TODO: no longer works
    if (point >= editor.getText().length) { return; }
    return editor.lineTextForBufferRow(point.row);
  }

  scopeRange (editor, point, scopeName) {
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

  generateSnippet (out, inline, parser) {
    // Substitute any placeholders in the tags
    if (out) {
      out = out.map(line => line.replace(Docblockr.placeholder, (string, placeholder) => {
        return Docblockr.placeholders[placeholder]
          ? Docblockr.placeholders[placeholder]()
          : string;
      }));
    }

    // align the tags
    const settingsAlignTags = config.get('align_tags') || 'deep';
    const deepAlignTags = settingsAlignTags === 'deep';
    const shallowAlignTags = ((settingsAlignTags === 'shallow') || (settingsAlignTags === true));
    if (out && (shallowAlignTags || deepAlignTags) && (!inline)) { out = this.alignTags(out); }

    // fix all the tab stops so they're consecutive
    if (out) { out = this.fixTabStops(out); }

    if (inline) {
      if (out) { return (' ' + out[0] + ' */'); } else { return (' $0 */'); }
    } else { return (this.createSnippet(out, parser) + (config.get('newline_after_block') ? '\n' : '')); }
  }

  alignTags (out) {
    // get the length of a string, after it is output as a snippet,
    // "${1:foo}" --> 3
    const outputWidth = str => str.replace(/[$][{]\d+:([^}]+)[}]/, '$1').replace('\\$', '$').length;
    // count how many columns we have
    let maxCols = 0;
    // this is a 2d list of the widths per column per line
    const widths = [];
    let returnTag;
    // Grab the return tag if required.
    if (config.get('per_section_indent')) { returnTag = config.get('return_tag') || '@return'; } else { returnTag = false; }

    for (let i = 0; i < out.length; i++) {
      if (out[i].startsWith('@')) {
        // Ignore the return tag if we're doing per-section indenting.
        if (returnTag && out[i].startsWith(returnTag)) { continue; }
        // ignore all the words after `@author`
        const columns = (!out[i].startsWith('@author')) ? out[i].split(' ') : ['@author'];
        widths.push(columns.map(outputWidth));
        maxCols = Math.max(maxCols, widths[widths.length - 1].length);
      }
    }
    // initialise a list to 0
    const maxWidths = this.fillArray(maxCols);

    const settingsAlignTags = config.get('align_tags') || 'deep';
    if (((settingsAlignTags === 'shallow') || (settingsAlignTags === true))) {
      maxCols = 1;
    }

    for (let i = 0; i < maxCols; i++) {
      for (let j = 0; j < widths.length; j++) {
        if (i < widths[j].length) { maxWidths[i] = Math.max(maxWidths[i], widths[j][i]); }
      }
    }
    // Convert to a dict so we can use .get()
    // maxWidths = dict(enumerate(maxWidths))

    // Minimum spaces between line columns
    const minColSpaces = config.get('min_spaces_between_columns') || 1;
    for (let i = 0; i < out.length; i++) {
      // format the spacing of columns, but ignore the author tag. (See #197)
      if ((out[i].startsWith('@')) && (!out[i].startsWith('@author'))) {
        const newOut = [];
        const splitArray = out[i].split(' ');
        for (let j = 0; j < splitArray.length; j++) {
          newOut.push(splitArray[j]);
          newOut.push(this.repeat(' ', minColSpaces) + (
            this.repeat(' ', ((maxWidths[j] || 0) - outputWidth(splitArray[j])))
          ));
        }
        out[i] = newOut.join('').trim();
      }
    }
    return out;
  }

  fixTabStops (out) {
    const tabIndex = this.counter();
    const swapTabs = (match, group1, group2, str) => (group1 + tabIndex() + group2);
    for (let i = 0; i < out.length; i++) { out[i] = out[i].replace(/(\$\{)\d+(:[^}]+\})/g, swapTabs); }
    return out;
  }

  createSnippet (out, parser) {
    let snippet = '';
    const regex = /^\s*@([a-zA-Z]+)/;
    const indentSpaces = ' '.repeat(config.get('indentation_spaces'));
    if (out) {
      if (config.get('spacer_between_sections') === 'true') {
        let lastTag = null;
        for (let i = 0; i < out.length; i++) {
          const match = regex.exec(out[i]);
          if (match && (lastTag !== match[1])) {
            lastTag = match[1];
            out.splice(i, 0, '');
          }
        }
      } else if (config.get('spacer_between_sections') !== 'false') {
        let lastLineIsTag = false;
        for (let i = 0; i < out.length; i++) {
          const match = regex.exec(out[i]);
          if (match) {
            if (!lastLineIsTag) { out.splice(i, 0, ''); }
            lastLineIsTag = true;
          }
        }
      }
      for (let i = 0; i < out.length; i++) {
        snippet += '\n' + (parser.settings.prefix || ' *') + (out[i] ? (indentSpaces + out[i]) : '');
      }
    } else { snippet += '\n' + (parser.settings.prefix || ' *') + indentSpaces + '${0:' + this.trailingString + '}'; }

    if (parser.settings.commentType === 'block') {
      snippet += '\n' + parser.settings.commentCloser;
    }

    return snippet;
  }
}

// Regular expression for catching and replacing placeholders
Docblockr.placeholder = /\{*?\{\{(.*?)\}\}\}*?/g;
// Placeholders are {{strings}} that are replaced using the functions bellow
Docblockr.placeholders = {
  date: () => (new Date()).toISOString().replace(/T.*/, ''),
  datetime: () => (new Date()).toISOString().replace(/Z$/, ''),
  br: () => '\n',
  spacer: () => '\t'
};
// Fetch and cache a parser instance for the requested Grammar if available, or
// show a warning notification and disable advanced documenting features if not.
// TODO: Define as a static property inside the class declaration
Docblockr.parsers = new Proxy(require('./grammars.json'), {
  get (target, scope) {
    const name = atom.grammars.grammarForScopeName(scope).name;
    const [grammar] = target.find(names => names.includes(name)) || [];
    if (!grammar && !config.get('simple_mode', { scope: [scope] })) {
      atom.notifications.addWarning('Docblockr: Missing matching Parser.', {
        description: 'Unfortunatelly the selected Grammar is currently unsupported.',
        dismissable: true
      });
    }
    // Disable or re-enable JsDoc generation for requested grammar
    config.set('simple_mode', !grammar, { scopeSelector: `.${scope}` });
    // Defer creation of the Parsers as much as possible
    return !target[grammar]
      ? (target[grammar] = require(`./grammars/${grammar}`))
      : target[grammar];
  }
});

module.exports = Docblockr;
