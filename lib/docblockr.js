const { Disposable } = require('atom');

const DocblockrWorker = require('./docblockr-worker.js');
const { config } = require('./utils');

module.exports = {
  activate: function () {
    this.docblockr = new DocblockrWorker();

    atom.commands.add('atom-workspace', 'docblockr:parse-tab', event => {
      if (this.docblockr.validateRequest(event, { // Parse Command
        preceding: true,
        precedingRegex: /^\s*(\/\*([*!])|###\*|\/\/\*)\s*$/
      })) {
        this.docblockr.parseCommand(event, false);
      } else if (this.docblockr.validateRequest(event, { // Indent Command
        preceding: true,
        precedingRegex: /^(\s*\*|\/\/\/)\s*$/
      })) {
        this.docblockr.indentCommand(event);
      } else {
        event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:parse-enter', event => {
      if (this.docblockr.validateRequest(event, { // Parse Command
        preceding: true,
        precedingRegex: /^\s*(\/\*([*!])|###\*|\/\/\*)\s*$/
      })) {
        this.docblockr.parseCommand(event, false);
      } else if (this.docblockr.validateRequest(event, { // Trim auto whitespace
        preceding: true,
        precedingRegex: /^\s*\*\s*$/,
        following: true,
        followingRegex: /^\s*$/,
        scope: 'comment.block'
      })) {
        this.docblockr.trimAutoWhitespaceCommand(event);
      } else if (this.docblockr.validateRequest(event, { // Deindent command
        preceding: true,
        precedingRegex: /^\s+\*\//
      })) {
        this.docblockr.deindentCommand(event);
      } else if (this.docblockr.validateRequest(event, { // Snippet-1 command
        preceding: true,
        precedingRegex: /^\s*\/\*$/,
        following: true,
        followingRegex: /^\*\/\s*$/
      })) {
        this.docblockr.write(event, '\n$0\n ');
      } else if (this.docblockr.validateRequest(event, { // Close block comment command
        preceding: true,
        precedingRegex: /^\s*\/\*\s*$/
      })) {
        this.docblockr.parseBlockCommand(event);
      } else if (this.docblockr.validateRequest(event, { // Extend line comments (// and #)
        preceding: true,
        precedingRegex: /^\s*(\/\/[/!]?|#)/,
        scope: 'comment.line'
      }) && config.get('extend_double_slash')) {
        const editor = event.target.closest('atom-text-editor').getModel();
        const cursorPosition = editor.getCursorBufferPosition();
        let lineText = editor.lineTextForBufferRow(cursorPosition.row);
        lineText = lineText.replace(/^(\s*[^\sa-z0-9]*\s*).*$/, '$1');
        editor.insertText('\n' + lineText);
      } else if (this.docblockr.validateRequest(event, { // Extend docblock by adding an asterix at start
        preceding: true,
        precedingRegex: /^\s*\*(?:.?|.*(?:[^*][^/]|[^*]\/|\*[^/]))\s*$/,
        scope: 'comment.block'
      })) {
        const _regex = /^(\s*\*\s*).*$/;
        const editor = event.target.closest('atom-text-editor').getModel();
        const cursorPosition = editor.getCursorBufferPosition();
        let lineText = editor.lineTextForBufferRow(cursorPosition.row);
        lineText = lineText.replace(_regex, '$1');
        editor.insertText('\n' + lineText);
      } else {
        event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:parse-inline', event => {
      if (this.docblockr.validateRequest(event, { // Parse inline command
        preceding: true,
        precedingRegex: /^\s*\/\*{2}$/
      })) {
        this.docblockr.parseCommand(event, true);
      } else {
        event.target.closest('atom-text-editor').getModel().insertNewline();
        // event.abortKeyBinding();
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:join', event => {
      // Join command
      if (this.docblockr.validateRequest(event, { scope: 'comment.block' })) {
        this.docblockr.joinCommand(event);
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:reparse', event => {
      // Reparse command
      if (this.docblockr.validateRequest(event, { scope: 'comment.block' })) {
        this.docblockr.reparseCommand(event);
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:wrap-lines', event => {
      // Wraplines command
      if (this.docblockr.validateRequest(event, { scope: 'comment.block' })) {
        this.docblockr.wrapLinesCommand(event);
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:decorate', event => {
      // Decorate command
      if (this.docblockr.validateRequest(event, { scope: 'comment.line' })) {
        this.docblockr.decorateCommand(event);
      }
    });

    atom.commands.add('atom-workspace', 'docblockr:decorate-multiline', event => {
      // Decorate Multiline command
      if (this.docblockr.validateRequest(event, { scope: 'comment.block' })) {
        this.docblockr.decorateMultilineCommand(event);
      }
    });
  },

  consumeSnippetsService: function (service) {
    this.docblockr.setSnippetsService(service);
    return new Disposable(() => {
      this.docblockr.setSnippetsService(null);
    });
  }
};
