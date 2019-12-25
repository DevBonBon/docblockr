const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('chai');

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
        dataset[key].forEach((data) => {
          it(data[0], () => {
            let out;
            if (Array.isArray(data[1])) {
              out = parser[key].apply(parser, data[1]);
            } else {
              out = parser[key](data[1]);
            }
            expect(out).to.deep.equal(data[2]);
          });
        });
      });
    }
  });
}
