const { CompositeDisposable } = require('atom');

const DocumenterRegistry = require('./DocumenterRegistry');
const DocsParser = require('./docsparser');
const { escape, config } = require('./utils');
const util = require('util');
const Docblock = require('./Docblock');

// TODO: Consider making some fields private throughout the project
module.exports = class Docblockr {
  static disposables = new CompositeDisposable();

  static config = {
    template: {
      description: 'Template for generating (documenting) comments. See package docs.',
      type: 'string',
      default: JSON.stringify([
        ['', '', ''],
        [
          '~', '0b110', [['// ']],
          '~', '0b001', [[' * ']],
          '&', '0b100', [
            ['', '', '', '', ''],
            ['name', '&', '0b001', [[''], ['type']], 'param', 'returns', '$']
          ],
        ]
      ], null),
      order: 1
    },
    tags: {
      description: 'Templates for generating documentation tags. See package docs.',
      type: 'string',
      default: JSON.stringify([
        ['start', [
          ['@', '\t{', '}\t'],
          ['tag', '||', 'type', [[''], ['$', '[type]']]]
        ]],
        ['name', [
          [''],
          ['@', 'name', [
            ['[', ' \vdescription]\n'],
            ['identifier']
          ]]
        ]],
        ['param', [
          [''],
          ['@', 'param', [
            ['', '', '', '\t', '\n'],
            ['start', '&&', 'value', '[', 'identifier', '&&', 'value', [['=', ']'], ['value']], '$', '\u200B[description]']
          ]]
        ]],
        ['returns', [
          [''],
          ['@', 'returns', [
            ['', '', '\n'],
            ['start', '$', '\u200B[description]']
          ]]
        ]],
        ['type', [
          [''],
          ['@', 'type', [
            ['', '', '\n'],
            ['start', '$', '\u200B[description]']
          ]]
        ]]
      ], null),
      order: 2
    },
    notifications: {
      description: 'Toggle all missing documenter notifications.',
      type: 'boolean',
      default: true,
      order: 3
    },
    notations: {
      description: 'Patterns used to guess types of variables, function return values, etc.',
      type: 'object',
      default: DocsParser.notation.map
      // Can't really enforce correct format, as type names can be anything
    }
  };

  static deactivate () {
    this.disposables.dispose();
  }

  static activate () {
    const docblockr = new Docblockr();

    this.disposables.add(atom.commands.add('atom-text-editor', {
      'docblockr:join': event => {
        // console.log('Join command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.joinCommand(event);
        }
      },
      'docblockr:reparse': event => {
        // console.log('Reparse command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.reparseCommand(event);
        }
      },
      'docblockr:wrap-lines': event => {
        // console.log('Wraplines command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.wrapLinesCommand(event);
        }
      },
      'docblockr:decorate': event => {
        // console.log('Decorate command');
        if (docblockr.validateRequest({ scope: 'comment.line' })) {
          docblockr.decorateCommand(event);
        }
      },
      'docblockr:decorate-multiline': event => {
        // console.log('Decorate Multiline command');
        if (docblockr.validateRequest({ scope: 'comment.block' })) {
          docblockr.decorateMultilineCommand(event);
        }
      }
    }));
  }

  // TODO: Make 'snippets' private ?
  static snippets (service) {
    delete this.insertSnippet;
    this.insertSnippet = service.insertSnippet;
    return { dispose: () => { delete this.insertSnippet;  } }
  }

  // provide our own service
  static docblockr () {
    return {
      addCommentMatcher: (scopes, blacklist, delimiters) =>
        this.addCommentMatcher(scopes, blacklist, delimiters),
      addGrammar: (scopes, whitelist, documenter) =>
        this.addGrammar(scopes, whitelist, documenter)
    };
  }

  // TODO; Can be simplified using optional chaining
  static insert (cursor, snippet, editor = cursor.editor) {
    return this.insertSnippet
      ? this.insertSnippet(snippet, editor, cursor)
      : atom.notifications.addError('Docblockr: Missing Snippets service.', {
        description: 'Support for tab stops has been disabled.',
        dismissable: true
      }) && editor.buffer.insert(cursor.getBufferPosition(), snippet);
  }

  // takes point object and cursor
  static nodeForPosition (position, cursor) {
    return 'tree' in cursor.editor.languageMode
      ? cursor.editor.languageMode.tree.rootNode.descendantForPosition(position)
      : {};
  }

  static addCommentMatcher (scopes, blacklist, delimiters) {
    scopes.forEach(scope => {
      // Only target TextEditors with the correct grammar scope
      const target = `atom-text-editor[data-grammar="${scope.replace('.', ' ')}"]`;
      // Create a closure by registering a scoped comment matcher command
      const command = `docblockr:match-comment-[${scope}]`;
      // Register all block comment delimiters provided
      delimiters.forEach(([opener, closer = [...opener].reverse().join('')]) => {
        // Register scoped comment matcher command and keybind trigger
        this.disposables.add(
          atom.commands.add(target, command, event =>
            this.matchComment([opener, closer], blacklist) ||
            event.abortKeyBinding()),
          atom.keymaps.add(module.filename,
            // Trigger keybind on last character of opening delimiter
            { [target]: { [opener[opener.length - 1]]: command } })
        );
      });
    });
  }

  static addGrammar (scopes, whitelist, documenter) {
    for (const scope of scopes) {
      // Only target text-editors with the correct grammar enabled
      const target = `atom-text-editor[data-grammar="${scope.replace('.', ' ')}"]`;
      // Custom scoped command for creating a closure
      const indent = `docblockr:indent[${scope}]`;
      const comment = `docblockr:comment[${scope}]`;
      atom.keymaps.add(module.filename, {
        [target]: {
          tab: indent,
          enter: comment,
          'shift-enter': comment
        }
      });
      // tab
      this.disposables.add(atom.commands.add(target, indent, event =>
        this.comment(whitelist, documenter, false) ||
        this.indent(whitelist) ||
        event.abortKeyBinding()));
      // enter and shift-enter
      this.disposables.add(atom.commands.add(target, comment, event =>
        this.comment(whitelist, documenter, event.originalEvent.shiftKey) ||
        event.abortKeyBinding()));
    }
  }

  /**
   * Matches a block comment closer with an opener at all applicable cursors
   * @return {Number} How many cursors were successfully processed, zero if none
   */
  static matchComment ([opener, closer], blacklist = []) {
    return atom.workspace.getActiveTextEditor().getCursors().filter(cursor => {
      const text = cursor.getCurrentBufferLine();
      const { row, column } = cursor.getBufferPosition();
      // Check if preceding text matches opener without the keybind character
      if (text.slice(0, column).endsWith(opener.slice(0, -1))) {
        const { typeId } = this.nodeForPosition({ row, column }, cursor);
        // Default to always appending closer when grammar isn't Tree-sitter based
        if (!blacklist.includes(typeId || -1)) {
          // Insert the keybind character, so that undo behaves as expected
          const character = opener.slice(-1);
          cursor.editor.buffer.insert({ row, column }, character);
          // Use transact, so the closer can be undone with a single command
          return cursor.editor.buffer.transact(() => {
            // Remove all text on row following the cursor
            cursor.editor.buffer.delete([[row, column], [row, Infinity]]);
            // Insert the comment as a snippet that has trailing text selected
            return this.insert(cursor, (new Docblock(0, !!this.snippets))
              .document([[character, ` ${closer}`], ['$', ` ${text.slice(column)}`, '$']]));
          });
        }
      }
    }).length;
  }

  /**
   * comment
   * @return {Number} How many cursors were successfully processed, zero if none
   */
  static comment (whitelist, { comments, ...documenter }, inline) {
    const cursors = atom.workspace.getActiveTextEditor().getCursors();
    return cursors.filter(cursor => {
      const { row, column } = cursor.getBufferPosition();
      const { text, typeId } = this.nodeForPosition({ row, column }, cursor);
      // Default to always ignoring the event when grammar isn't Tree-sitter based
      if (whitelist.includes(typeId || -1)) {
        const scopes = {
          uninitialized: 0b0000,
          initialized: 0b0001,
          inline: 0b0010,
          block: 0b0100,
          doc: 0b1000
        };

        let scope = scopes.uninitialized;
        // the order is important, otherwise the initialized check my give a
        // false positive as documentation comments are always the longest
        for (const type of ['doc', 'block', 'inline']) {
          // unpack comment opener and (optional) closer
          for (const [opener, closer = ''] of comments[type]) {
            // Check if the comment is enclosed by the opener and closer
            scope |= text.startsWith(opener) && text.endsWith(closer)
              // Initialized if any non-whitespace characters between delimiters
              ? /\S/.test(text.slice(opener.length, closer.length))
                ? scopes[type] & scopes.initialized
                : scopes[type]
              : scopes.uninitialized;
          }
        }
        // Shift-enter should do nothing when inside an inline comment
        scope ^= inline ? scopes.inline : scopes.default;

        return scope
          ? this.insert(cursor, (new Docblock(scope, !!this.snippets, documenter))
            .document(config.get('template')))
          : false;
      }
    }).length;
  }

  static indent (whitelist) {
    const cursors = atom.workspace.getActiveTextEditor().getCursors();
    return cursors.filter(cursor => {
      const { row, column } = cursor.getBufferPosition();
      const { typeId } = this.nodeForPosition({ row, column }, cursor);
      // Default to always ignoring the event when grammar isn't Tree-sitter based
      if (whitelist.includes(typeId || -1)) {
        const previousLine = cursor.editor.lineTextForBufferRow(row - 1);
        // Ignore event if indenting cursor is as long / longer than
        if (column < previousLine.length) {
          const currentLine = cursor.getCurrentBufferLine();

          const formfeed = previousLine.indexOf('\u200B'); // zero width space
          const length = formfeed > -1
            ? formfeed - currentLine.length
            : previousLine.slice(previousLine.slice(column).search(/\s/)).search(/\S/) + column - currentLine.length;
          if (length > 0) {
            let indent = cursor.editor.getTabText();
            const tabLength = cursor.editor.getTabLength();

            indent = indent.repeat(length / tabLength) + ''.padEnd(length % tabLength);

            // Use transact, so the closer can be undone with a single command
            return cursor.editor.buffer.transact(() => {
              cursor.editor.buffer.insert({ row, column }, indent);
            });
          }
        }
      }
    }).length;
  }

  constructor () {}

  // TODO: remove once transition to 'getMatchingCursor' is complete
  validateRequest ({ scope, preceding, following }) {
    const cursors = atom.workspace.getActiveTextEditor().getCursors();
    const targetCursor = Docblockr.matchingCursors({ preceding, following, scope }).pop();
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
  static matchingCursors ({ preceding = /(?:)/, following = /(?:)/, scope = '' }) {
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

  static documentt (inline = false, cursors = Docblockr.matchingCursors({ preceding: /^\s*\/\*\*/, following: /\*\//, scope: 'comment.block' })) {
    return cursors.length && cursors.every(cursor => {
      const parser = new Docblockr.parsers[cursor.editor.getGrammar().scopeName]();
      // console.log(cursor.editor.getGrammar().scopeName, cursor.editor.getRootScopeDescriptor())

      const row = cursor.getBufferRow();
      const position = { row, column: Infinity };

      const [node] = cursor.editor.languageMode.tree.rootNode.descendantsOfType(parser.entries, position);
      const blocks = parser.parse([node], new Map(parser.pattern));

      console.log(blocks)

      const [docblock, placeholders] = JSON.parse(config.get('docblock'));
      const templates = JSON.parse(config.get('templates'));

      const maxLength = [];

      const snippet = String.raw({ raw: docblock }, ...placeholders.map(placeholder =>
        blocks.flatMap(block => block.tag === placeholder
          ? block.document(templates[placeholder])
          : [])
          .map(block => block.replace('\t', ' \t').split('\t').map((block, index) => {
            maxLength[index] = block.length >= (maxLength[index] || 0)
              ? block.length
              : maxLength[index];
            return block;
          })).map(blocks => blocks.map((block, index) => block.padEnd(maxLength[index])).join(''))));

      console.log(maxLength)
      console.log(snippet)
    });
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

    const hasTypes = (new Docblockr.parsers[editor.getGrammar().scopeName]()).settings.typeInfo;
    const extraIndent = ((hasTypes === true) ? '\\s+\\S+' : '');

    const regex = [
      new RegExp(util.format('^\\s*(\\*|\\/\\/\\/)(\\s*@(?:param|property)%s\\s+\\S+\\s+)\\S', extraIndent)),
      new RegExp(util.format('^\\s*(\\*|\\/\\/\\/)(\\s*@(?:returns?|define)%s\\s+\\S+\\s+)\\S', extraIndent)),
      new RegExp('^\\s*(\\*|\\/\\/\\/)(\\s*@[a-z]+\\s+)\\S'),
      new RegExp('^\\s*(\\*|\\/\\/\\/)(\\s*)')
    ];

    let spaces = null;
    let i, matches;
    for (i = 0; i < regex.length; i++) {
      matches = regex[i].exec(prevLine);
      if (matches != null) {
        spaces = matches[1].length;
      }
    }

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
    let count = 0;
    const tabIndex = () => ++count;
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
    Docblockr.insert(editor.getLastCursor(), text) || event.abortKeyBinding();
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

  repeat (string, number) {
    return Array(Math.max(0, number) + 1).join(string);
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
};
