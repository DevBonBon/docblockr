const JsParser = require('../lib/grammars/JavaScript');
const CppParser = require('../lib/grammars/C');
const RustParser = require('../lib/grammars/Rust');
const PhpParser = require('../lib/grammars/PHP');
const CoffeeParser = require('../lib/grammars/CoffeeScript');
const ActionscriptParser = require('../lib/grammars/ActionScript');
const ObjCParser = require('../lib/grammars/Objective-C');
const JavaParser = require('../lib/grammars/Java');
const TypescriptParser = require('../lib/grammars/TypeScript');
const SassParser = require('../lib/grammars/Sass');

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { expect } = require('chai');

// Hack to let us call parsers by filename
const parsers = {
  JsParser,
  CppParser,
  RustParser,
  PhpParser,
  CoffeeParser,
  ActionscriptParser,
  ObjCParser,
  JavaParser,
  TypescriptParser,
  SassParser
};

const filepath = path.resolve(path.join(__dirname, 'dataset/languages'));
const files = fs.readdirSync(filepath);

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
          parser = parsers[parserName];
        });
    });

    for (const key in dataset) {
      describe(key, () => {
        dataset[key].forEach((data) => {
          it(data[0], () => {
            const out = Array.isArray(data[1])
              ? parser[key](...data[1])
              : parser[key](data[1]);
            expect(out).to.deep.equal(data[2]);
          });
        });
      });
    }
  });
}
