var createDefaultStream = require('./lib/default_stream');
var Test = require('./lib/test');
var createResult = require('./lib/results');
var through = require('through');

var canEmitExit = typeof process !== 'undefined' && process
  && typeof process.on === 'function' && process.browser !== true;
var canExit = typeof process !== 'undefined' && process
  && typeof process.exit === 'function';

function createExitHarness(conf) {
  if (!conf) conf = {};
  var harness = createHarness({
    autoclose: conf.autoclose || false
  });

  var stream = harness.createStream({objectMode: conf.objectMode});
  var es = stream.pipe(conf.stream || createDefaultStream());
  if (canEmitExit) {
    es.on('error', function () {
      harness._exitCode = 1
    });
  }

  var ended = false;
  stream.on('end', function () {
    ended = true
  });

  if (conf.exit === false) return harness;
  if (!canEmitExit || !canExit) return harness;

  process.on('exit', function (code) {

    // let the process exit cleanly.
    if (code !== 0) {
      return
    }

    harness.close();
    process.exit(code || harness._exitCode);
  });

  return harness;
}

function createHarness(conf_) {
  if (!conf_) conf_ = {};
  var results = createResult();
  if (conf_.autoclose !== false) {
    results.once('done', function () {
      results.close()
    });
  }

  var test = function (name, conf, cb) {
    var t = new Test(name, conf, cb);
    test._tests.push(t);

    (function inspectCode(st) {
      st.on('test', function sub(st_) {
        inspectCode(st_);
      });
      st.on('result', function (r) {
        if (!r.ok && typeof r !== 'string') test._exitCode = 1
      });
    })(t);

    results.push(t);
    return t;
  };
  test._results = results;
  test._tests = [];
  test.createStream = function (opts) {
    return results.createStream(opts);
  };

  var only = false;
  test.only = function (name) {
    if (only) throw new Error('there can only be one only test');
    results.only(name);
    only = true;
    return test.apply(null, arguments);
  };
  test._exitCode = 0;

  test.close = function () {
    results.close()
  };

  return test;
}


var loadTest = (function () {
  var harness;
  var lazyLoad;

  function getHarness(opts) {
    if (!opts) opts = {};
    opts.autoclose = !canEmitExit;
    if (!harness) harness = createExitHarness(opts);
    return harness;
  }

  lazyLoad = function () {
    return getHarness().apply(this, arguments);
  };

  lazyLoad.only = function () {
    return getHarness().only.apply(this, arguments);
  };

  lazyLoad.createStream = function (opts) {
    if (!opts) opts = {};
    if (!harness) {
      var output = through();
      getHarness({stream: output, objectMode: opts.objectMode});
      return output;
    }
    return harness.createStream(opts);
  };

  lazyLoad.getHarness = getHarness;

  return lazyLoad;
})();

exports = module.exports = loadTest;