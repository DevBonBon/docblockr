const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const assert = require('assert').strict;

var filepath = path.resolve(path.join(__dirname, 'dataset/languages'));
var files = fs.readdirSync(filepath);

for (const name of files) {
  const fileName = 'Parser_' + name.split('.')[0];
  describe(fileName, () => {
    let parser;
    const dataset = yaml.load(fs.readFileSync(path.join(filepath, name), 'utf8'));
    const parserName = dataset.name;
    delete dataset.name;

    beforeEach(() => {
      return atom.packages.activatePackage(path.resolve(__dirname, '../'))
        .then(() => {
          parser = new (require(`../lib/grammars/${parserName}`))();
        });
    });

    for (const key in dataset) {
      describe(key, () => {
        dataset[key].forEach(([description, input, output]) => {
          it(description, () => {
            assert.deepEqual(Array.isArray(input)
              ? parser[key].apply(parser, input)
              : parser[key](input), output);
          });
        });
      });
    }
  });
}
