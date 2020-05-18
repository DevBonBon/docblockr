const Generic = require('./Generic');

class JavaScript extends Generic {}

JavaScript.types = {
  158: 'OBJECT',
  105: 'NUMBER'
};
JavaScript.entryTypes = [
  'method_definition'
];
JavaScript.pattern = {
  // Method definition
  205: {
    tag: 'name',
    // Method identifier
    227: JavaScript.identifier,
    // Formal parameters
    203: {
      tag: 'param',
      // Plain parameter identifier
      1: JavaScript.identifier,
      // Asignment expression
      159: JavaScript.assignment,
      // Object destructuring parameter
      228: {
        // Plain parameter identifier
        22: JavaScript.identifier,
        // Reassigning object pattern
        206: {
          // Plain parameter identifier
          1: JavaScript.identifier,
          // Asignment expression
          183: JavaScript.assignment
        }
      }
    },
    // Method body statement
    133: {
      // Return statement
      146: {
        tag: 'returns',
        // Object primitive
        158: node => [{ value: node.text, type: node.typeId }]
      }
    }
  }
};

module.exports = JavaScript;
