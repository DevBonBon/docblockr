const Generic = require('./Generic');

class JavaScript extends Generic {
  constructor () {
    super();

    this.types = {
      ...this.types
    };

    this.dictionary = {
      type: {
        ...this.dictionary.type || {},
        159: this.types.OBJECT,
        105: this.types.NUMBER
      }
    };

    this.entries = [
      'method_definition'
    ];

    this.pattern = [
      // Method definition
      [206, [
        ['tag', 'name'],
        // Method identifier
        [229, JavaScript.identifier],
        // Formal parameters
        [204, [
          ['tag', 'param'],
          // Plain parameter identifier
          [1, JavaScript.identifier],
          // Asignment expression
          [160, JavaScript.assignment],
          // Object destructuring parameter
          [228, [
            // Plain parameter identifier
            [230, JavaScript.identifier],
            // Reassigning object pattern
            [207, [
              // Plain parameter identifier
              [1, JavaScript.identifier],
              // Asignment expression
              [184, JavaScript.assignment]
            ]]
          ]]
        ]],
        // Method body statement
        [134, [
          // Return statement
          [147, [
            ['tag', 'returns'],
            // Object primitive
            [159, JavaScript.value]
          ]]
        ]]
      ]]
    ];

    // disable comment block matchin when inside these nodes
    this.disabled = [/* whatever the regex node is */];
  }
}

module.exports = JavaScript;
