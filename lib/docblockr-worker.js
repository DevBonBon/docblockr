const { config } = require('./utils');
// const Snippets = atom.packages.activePackages.snippets.mainModule;

class DocBlockrAtom {
  // TODO: Make 'DocBlockrAtom.snippets' private
  static get snippetsService () {
    if (!DocBlockrAtom.snippets) {
      atom.notifications.addFatalError('Docblockr: Missing Snippets service.', {
        detail: 'Please ensure the Snippets package is enabled.',
        dismissable: true,
        icon: 'flame'
      });
    }
    return DocBlockrAtom.snippets;
  }

  static set snippetsService (service) {
    DocBlockrAtom.snippets = service;
  }

  /**
   * Get all Cursors that match the given scope and regular expressions
   * @param  {RegExp} [preceding=/(?:)/]      RegExp to check preceding text against
   * @param  {RegExp} [following=/(?:)/]      RegExp to check following text against
   * @param  {String} [scope='comment.block'] Scope descriptor to check for
   * @return {Array<Cursor>} An array of mathcing Cursors, if any
   */
  static matchingCursors (preceding = /(?:)/, following = /(?:)/, scope = 'comment.block') {
    return atom.workspace.getActiveTextEditor().getCursors().filter(cursor => {
      const scopes = cursor.getScopeDescriptor().getScopesArray();
      if (scopes.some(cursorScope => cursorScope === scope)) {
        const text = cursor.getCurrentBufferLine();
        const column = cursor.getBufferColumn();
        return preceding.test(text.slice(0, column)) && following.test(text.slice(column + 1));
      }
    });
  }

  // TODO: remove once transition to 'getMatchingCursor' is complete
  validateRequest (event, { scope, precedingRegex, followingRegex }) {
    const cursors = atom.workspace.getActiveTextEditor().getCursors();
    const targetCursor = DocBlockrAtom.matchingCursors(precedingRegex, followingRegex, scope).pop();
    // If a matching cursor was found, remove all other cursors and return true
    return targetCursor
      ? cursors.every(cursor => cursor === targetCursor || !cursor.destroy())
      : false;
  }

  /**
   * Get a parser instance for the requested grammar if available,
   * or show a warning notification and disable JsDoc generation if not.
   * @param  {String}     scope                       Scope of requested grammar
   * @param  {String}     [scopeSelector=`.${scope}`] A trick to add mising dot
   *                                                  to config scope selector
   * @return {DocsParser} Matching parser instance if found, or undefined
   * @todo   Change this into a Proxy to get rid of the function call?
   */
  static getParser (scope, scopeSelector = `.${scope}`) {
    const supportedGrammar = scope in DocBlockrAtom.parsers;
    if (!supportedGrammar) {
      atom.notifications.addWarning('Docblockr: Missing matching parser.', {
        detail: 'Unfortunatelly the selected grammar is currently unsupported.',
        dismissable: true
      });
    }
    // Disable or re-enable JsDoc generation for requested grammar
    atom.config.set('docblockr.simple_mode', supportedGrammar, { scopeSelector });
    return DocBlockrAtom.parsers[scope];
  }

  parseCommand (event, inline) {
    const editor = atom.workspace.getActiveTextEditor();
    const cursor = editor.getLastCursor(); // will handle only one instance
    const text = cursor.getCurrentBufferLine();
    const { row, column } = cursor.getBufferPosition();
    // Get trailing string without */ at the end
    const trailingString = text.slice(column + 1).replace(/\s*\*\/\s*$/, '');
    // Remove trailing characters (will write them appropriately later)
    if (!cursor.isAtEndOfLine) {
      editor.deleteToEndOfLine();
    }

    const parser = DocBlockrAtom.getParser(editor.getGrammar().scopeName);

    // use trailing string as a description of the function
    if (trailingString) { parser.setNameOverride(trailingString); }

    // read the next line
    const nextLine = parser.getDefinition(editor, { row: row + 1, column }, this.readLine);

    if (parser.isExistingComment(nextLine)) {
      return DocBlockrAtom.snippetsService
        ? DocBlockrAtom.snippetsService.insertSnippet(`\n *${' '.repeat(config.get('indentation_spaces'))}`, editor)
        : false;
    }

    // match against a function declaration.
    const out = parser.parse(nextLine, inline);
    let snippet = this.generateSnippet(out, inline, trailingString, parser);
    // atom doesnt currently support, snippet end by default
    // so add $0
    if ((snippet.search(/\${0:/) < 0) && (snippet.search(/\$0/) < 0)) { snippet += '$0'; }
    return DocBlockrAtom.snippetsService
      ? DocBlockrAtom.snippetsService.insertSnippet(snippet, editor)
      : false;
  }

  /**
   * Perform actions for a single-asterix block comment
   */
  parseBlockCommand (event) {
    const editor = atom.workspace.getActiveTextEditor();
    const cursor = editor.getLastCursor(); // will handle only one instance
    const text = cursor.getCurrentBufferLine();
    const { row, column } = cursor.getBufferPosition();
    // Get trailing string without */ at the end
    const trailingString = text.slice(column + 1).replace(/\s*\*\/\s*$/, '');
    // Remove trailing characters (will write them appropriately later)
    if (!cursor.isAtEndOfLine) {
      editor.deleteToEndOfLine();
    }

    const parser = DocBlockrAtom.getParser(editor.getGrammar().scopeName);

    // use trailing string as a description of the function
    if (trailingString) { parser.setNameOverride(trailingString); }

    // read the next line
    const nextLine = parser.getDefinition(editor, { row: row + 1, column }, this.readLine);

    // Build the string to write
    let string = '\n';

    // Might include asterixes
    if (config.get('c_style_block_comments')) {
      string += ' *' + ' '.repeat(config.get('indentation_spaces'));
    }

    // Write indentation and trailing characters. Place cursor before
    // trailing characters

    string += '$0';
    string += trailingString;

    // Close if needed
    if (!parser.isExistingComment(nextLine)) {
      string += '\n */';
    }
    return DocBlockrAtom.snippetsService
      ? DocBlockrAtom.snippetsService.insertSnippet(string, editor)
      : false;
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
    const spaces = config.get('indentation_spaces');

    const regex = /^(\s*\*)\s*$/;
    lineText = lineText.replace(regex, '$1\n$1' + ' '.repeat(spaces));
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
        editor.insertText(' '.repeat(toInsert));
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

  decorateMultilineCommand (event) {
    const editor = event.target.closest('atom-text-editor').getModel();
    const pos = editor.getCursorBufferPosition();
    const whitespaceRe = /^(\s*)\/\*/;
    const tabSize = config.get('tabLength', 'editor');
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
    // strip out leading spaces, since inserting a snippet keeps the indentation
    text = text.replace(/\n\s+\*/g, '\n *');
    // replace [bracketed] [text] with a tabstop
    text = text.replace(/(\[.+?\])/g, (m, g1) => `\${${tabIndex()}:${g1}}`);

    editor.buffer.delete(([scopeRange[0], scopeRange[1]]));
    editor.setCursorBufferPosition(scopeRange[0]);
    if ((text.search(/\${0:/) < 0) && (text.search(/\$0/) < 0)) { text += '$0'; }
    return DocBlockrAtom.snippetsService
      ? DocBlockrAtom.snippetsService.insertSnippet(text, editor)
      : false;
  }

  wrapLinesCommand (event) {
    /**
     * Reformat description text inside a comment block to wrap at the correct length.
     * Wrap column is set by the first ruler (set in Default.sublime-settings), or 80 by default.
     * Shortcut Key: alt+q
     */
    const editor = event.target.closest('atom-text-editor').getModel();
    const pos = editor.getCursorBufferPosition();
    // const tabSize = config.get('tabLength', 'editor');
    const wrapLen = config.get('preferredLineLength', 'editor');

    const indentSpaces = ' '.repeat(config.get('indentation_spaces'));
    const indentSpacesSamePara = ' '.repeat(config.get('indentation_spaces_same_para'));
    const spacerBetweenSections = config.get('spacer_between_sections') === 'true';
    const spacerBetweenDescTags = config.get('spacer_between_sections') !== 'false';

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
    // strip start \n
    if (text.search(/^\n/) > -1) { text = text.replace(/^\n/, ''); }
    // add end \n
    if (text.search(/\n$/) < 0) { text += '\n'; }
    editor.setTextInBufferRange([startPoint, endPoint], text);
  }

  getIndentSpaces (editor, line) {
    const hasTypes = DocBlockrAtom.getParser(editor.getGrammar().scopeName).settings.typeInfo;
    const extraIndent = ((hasTypes === true) ? '\\s+\\S+' : '');

    const regex = [
      new RegExp(`^\\s*(\\*|\\/\\/\\/)(\\s*@(?:param|property)${extraIndent}\\s+\\S+\\s+)\\S`),
      new RegExp(`^\\s*(\\*|\\/\\/\\/)(\\s*@(?:returns?|define)${extraIndent}\\s+\\S+\\s+)\\S`),
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

  generateSnippet (out, inline, trailingString, parser) {
    // # substitute any variables in the tags

    if (out) { out = this.substituteVariables(out); }

    // align the tags
    if (out && config.get('align_tags') && !inline) { out = this.alignTags(out); }

    // fix all the tab stops so they're consecutive
    if (out) { out = this.fixTabStops(out); }

    if (inline) {
      if (out) { return (' ' + out[0] + ' */'); } else { return (' $0 */'); }
    } else {
      return (this.createSnippet(out, trailingString, parser) + (config.get('newline_after_block') ? '\n' : ''));
    }
  }

  substituteVariables (out) {
    const getConst = (match, group, str) => {
      const varName = group;
      if (varName === 'datetime') {
        const datetime = new Date();
        return formatTime(datetime);
      } else if (varName === 'date') {
        const datetime = new Date();
        return datetime.toISOString().replace(/T.*/, '');
      } else { return match; }
    };
    const formatTime = datetime => {
      const lengthFix = x => `${x < 10 && '0'}${x}`;
      const hour = lengthFix(datetime.getHours());
      const min = lengthFix(datetime.getMinutes());
      const sec = lengthFix(datetime.getSeconds());
      const tz = datetime.getTimezoneOffset() / -60;
      let tzString;
      if (tz >= 0) { tzString = '+'; } else { tzString = '-'; }
      tzString += lengthFix(Math.floor(Math.abs(tz)).toString()) + ((tz % 1) * 60);
      datetime = datetime.toISOString().replace(/T.*/, '');
      return (datetime += 'T' + hour + ':' + min + ':' + sec + tzString);
    };

    return out.map(line => line.replace(/\{\{([^}]+)\}\}/g, getConst));
  }

  alignTags (out) {
    // get the length of a string, after it is output as a snippet,
    // "${1:foo}" --> 3
    const outputWidth = str => str.replace(/[$][{]\d+:([^}]+)[}]/, '$1').replace('\\$', '$').length;
    // count how many columns we have
    let maxCols = 0;
    // this is a 2d list of the widths per column per line
    const widths = [];
    // Grab the return tag if required.
    const returnTag = config.get('per_section_indent')
      ? config.get('return_tag')
      : false;

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
    const maxWidths = new Array(maxCols).fill(0);

    const alignTags = config.get('align_tags');
    if (alignTags && alignTags !== 'deep') { maxCols = 1; }

    for (let i = 0; i < maxCols; i++) {
      for (let j = 0; j < widths.length; j++) {
        if (i < widths[j].length) { maxWidths[i] = Math.max(maxWidths[i], widths[j][i]); }
      }
    }
    // Convert to a dict so we can use .get()
    // maxWidths = dict(enumerate(maxWidths))

    for (let i = 0; i < out.length; i++) {
      // format the spacing of columns, but ignore the author tag. (See #197)
      if ((out[i].startsWith('@')) && (!out[i].startsWith('@author'))) {
        const newOut = [];
        const splitArray = out[i].split(' ');
        for (let j = 0; j < splitArray.length; j++) {
          newOut.push(splitArray[j]);
          newOut.push(' '.repeat(config.get('min_spaces_between_columns')) +
            ' '.repeat(Math.max(0, maxWidths[j] - outputWidth(splitArray[j])))
          );
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

  createSnippet (out, trailingString, parser) {
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
    } else {
      snippet += '\n' + (parser.settings.prefix || ' *') + indentSpaces + '${0:' + trailingString + '}';
    }

    if (parser.settings.commentType === 'block') {
      snippet += '\n' + parser.settings.commentCloser;
    }

    return snippet;
  }
}

DocBlockrAtom.parsers = {};

require('./grammars.json').forEach(({ file, scopes }) => {
  scopes.forEach(scope => {
    // Defers creating the parsers as much as possible
    // As Javascript passes objects by reference this isn't as bad as it looks
    Object.defineProperty(DocBlockrAtom.parsers, scope, {
      get: () => {
        delete DocBlockrAtom.parsers[scope];
        return (DocBlockrAtom.parsers[scope] = new (require(`./languages/${file}`))());
      }
    });
  });
});

module.exports = DocBlockrAtom;
