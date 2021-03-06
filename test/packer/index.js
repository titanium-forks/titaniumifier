
require('should');
require('longjohn');

var AdmZip = require('adm-zip');

var vm = require('vm');
var path = require('path');
var packer = require('../../packer');
var fs = require('../../lib/util/fs');

var buildDir = path.resolve(__dirname, 'build');

var Titanium = {
  Platform: {
    architecture: 'fake42'
  },
  API: {
    log: console.log.bind(console),
    info: console.log.bind(console),
    error: console.error.bind(console),
    warn: console.warn.bind(console),
    trace: console.trace.bind(console)
  }
};

before(function () {
  return fs.rimraf(buildDir).then(function () {
    return fs.mkdirp(buildDir);
  });
});

describe("Building", function () {

  it("should work", function () {
    this.timeout(20e3);

    return packer.build({
      entry: path.resolve(__dirname, 'module-1')
    })
    .tap(function (zip) {
      return zip.writeModule(buildDir);
    })
    .tap(function (zip) {
      return zip.writeBundle(buildDir);
    });
  });

  it("should create the right zip", function () {
    return assertIsFile(path.resolve(buildDir, 'module-1-commonjs-0.1.2.zip'));
  });

  it("should extract the bundle", function () {
    return assertIsFile(path.resolve(buildDir, 'module-1.js'));
  });

  it("should write lower case zipfiles", function () {
    return packer.build({
      entry: path.resolve(__dirname, 'module-2')
    })
    .then(function (zip) {
      return zip.writeModule(buildDir);
    })
    .then(function () {
      return assertIsFile(path.resolve(
        buildDir, 'fake-upper-case-name-commonjs-0.1.2.zip'));
    });
  });

  it("should bundle the collateral folders", function () {
    var zip = new AdmZip(path.resolve(
      buildDir, 'module-1-commonjs-0.1.2.zip'));

    zip.getEntry('modules/commonjs/module-1/0.1.2/example/app.js')
      .name.should.eql('app.js');

    zip.getEntry('modules/commonjs/module-1/0.1.2/documentation/index.md')
      .name.should.eql('index.md');
  });

});

describe("Bundling", function () {
  var entry = path.resolve(__dirname, 'module-1');
  var packedFile = path.resolve(buildDir, 'module-1.js');

  var promise = packer.pack(entry, {
    // no config
  });

  it("should work", function () {
    return promise.then(function (packed) {
      return fs.writeFile(packedFile, packed.source);
    });
  });

  it("should have merged native deps", function () {
    return promise.then(function (packed) {
      packed.should.have.a.property('nativeDependencies').eql({
        'a.native.dep': '*',
        'another.native.dep': '*'
      });
    });
  });

  it("shouldn’t leak our paths", function () {
    return promise.then(function (packed) {
      var source = packed.source.toString('utf8');
      var root = path.resolve(__dirname, '..', '..');

      source.should.not.containEql(root);
    });
  });

  it("should have resolved correctly the shadowed main", function () {
    var _module = { exports: {} };

    return fs.readFile(packedFile).then(function (src) {
      vm.runInNewContext(src, {
        Titanium: Titanium,
        Ti: Titanium,
        console: console,
        describe: describe,
        it: it,
        exports: _module.exports,
        module: _module,
        clearInterval: clearInterval,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        setTimeout: setTimeout
      }, packedFile);

      _module.exports.should.eql(42);
    });
  });

});

function assertIsFile(file) {
  return fs.isFile(file).then(function (isFile) {
    isFile.should.be.true;
  });
}
