var tap = require('tap');
var Harness = require('../harness');
var Promise  = require('promise-polyfill');
var through = require('through');
var assert = require('chai').assert;
var test = tap.test;
var MY_MESSAGE = 'my assertion message';

var TEST_END = 'test.end';
function noop() {}
function error() {
  assert(false, MY_MESSAGE);
}
function timeoutTest(time) {
  return function(done) {
    setTimeout(done, time);
  };
}
function timeoutTestError(time) {
  return function(done) {
    setTimeout(function() {
      throw new Error('invalid');
      done();
    }, time);
  };
}

test('harness single group all pass', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(4);

  test('test1', noop);
  test('test2', noop);

  var output = har.run();
  var index = 0;
  output.on('data', function(data) {
    if (data.type !== TEST_END) {
      return;
    }
    data = data.data;
    if (index === 0) {
      t.is(data.name, 'test1');
      t.is(data.success, true);
      index++;
    } else {
      t.is(data.name, 'test2');
      t.is(data.success, true);
    }
  });
  output.on('end', t.end);
});

test('harness single group all pass beforeEach and afterEach', function(t) {
  var har = Harness();
  var test = har.createGroup();
  var beforeCalled = false;
  var afterCalled = false;
  t.plan(6);

  test.beforeEach(function() {
    return new Promise(function(resolve) {
      setTimeout(function() {
        beforeCalled = true;
        resolve();
      }, 10);
    });
  });

  test.afterEach(function() {
    return new Promise(function(resolve) {
      setTimeout(function() {
        afterCalled = true;
        resolve();
      }, 10);
    });
  });

  test('test1', noop);
  test('test2', noop);

  var output = har.run();
  var index = 0;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }
    var data = info.data;

    if (index === 0) {
      t.ok(beforeCalled);
      t.is(data.name, 'test1');
      t.is(data.success, true);
    } else {
      t.ok(afterCalled);
      t.is(data.name, 'test2');
      t.is(data.success, true);
    }
    index++;
  });
  output.on('end', t.end);
});

test('success multiple errors', function(t) {
  var har = Harness();
  var test = har.createGroup();

  test('test1', error);
  test('test2', noop);
  test('test3', error);

  var output = har.run();
  var index = 0;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }

    var data = info.data;
    if (index === 0) {
      t.equal(data.name, 'test1');
      t.notOk(data.success);
      t.equal(data.error.message, MY_MESSAGE);
    } else if (index === 1) {
      t.equal(data.name, 'test2');
      t.ok(data.success);
    } else {
      t.equal(data.name, 'test3');
      t.notOk(data.success);
      t.equal(data.error.message, MY_MESSAGE);
    }
    index++;
  });
  output.on('end', t.end);
});

test('multiple groups', function(t) {
  var har = Harness();
  var test1 = har.createGroup();
  var test2 = har.createGroup();

  test1('test1', error);
  test2('test2', noop);

  var output = har.run();
  var index = 0;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }

    var data = info.data;
    if (index === 0) {
      t.equal(data.name, 'test1');
      t.notOk(data.success);
      t.equal(data.error.message, MY_MESSAGE);
    } else {
      t.equal(data.name, 'test2');
      t.ok(data.success);
    }
    index++;
  });
  output.on('end', t.end);
});

test('group without tests', function(t) {
  var har = Harness();
  har.createGroup();
  var output = har.run();
  output.on('end', t.end);
});

test('harness single group all pass async', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(4);

  test('test1', noop);
  test('test2', noop);

  var output = har.run({ async: true });
  var index = 0;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }

    var data = info.data;
    if (index === 0) {
      t.equal(data.name, 'test1');
      t.ok(data.success);
      index++;
    } else {
      t.equal(data.name, 'test2');
      t.ok(data.success);
    }
  });
  output.on('end', t.end);
});

test('harness async larger than group size', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(24);

  test('test1', noop);
  test('test2', noop);
  test('test3', noop);
  test('test4', noop);
  test('test5', noop);
  test('test6', noop);
  test('test7', noop);
  test('test8', noop);
  test('test9', noop);
  test('test10', noop);
  test('test11', noop);
  test('test12', noop);

  var output = har.run({ async: true });
  var index = 1;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }
    var data = info.data;
    t.equal(data.name, 'test' + index);
    t.ok(data.success);
    index++;
  });
  output.on('end', t.end);
});

test('harness async preserves order on success', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(24);

  test('test1', timeoutTest(30));
  test('test2', timeoutTest(50));
  test('test3', timeoutTest(10));
  test('test4', timeoutTest(20));
  test('test5', timeoutTest(40));
  test('test6', timeoutTest(10));
  test('test7', timeoutTest(20));
  test('test8', timeoutTest(30));
  test('test9', timeoutTest(10));
  test('test10', timeoutTest(30));
  test('test11', timeoutTest(20));
  test('test12', timeoutTest(0));

  var output = har.run({ async: true });
  var index = 1;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }
    var data = info.data;
    t.equal(data.name, 'test' + index);
    t.ok(data.success);
    index++;
  });
  output.on('end', t.end);
});

test('harness async preserves order on errors', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(8);

  test('test1', timeoutTestError(30));
  test('test2', timeoutTestError(50));
  test('test3', timeoutTest(10));
  test('test4', timeoutTestError(0));

  var output = har.run({ async: true });
  var index = 1;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }
    var data = info.data;
    if (index == 3) {
      t.equal(data.name, 'test' + index);
      t.ok(data.success);
    } else {
      t.equal(data.name, 'test' + index);
      t.equal(data.success, false);
    }

    index++;
  });
  output.on('end', t.end);
});

test('harness async bunch size change', function(t) {
  var har = Harness();
  var test = har.createGroup();
  t.plan(16);

  test('test1', timeoutTest(30));
  test('test2', timeoutTest(50));
  test('test3', timeoutTest(10));
  test('test4', timeoutTest(20));

  test = har.createGroup();
  test('test5', timeoutTest(40));
  test('test6', timeoutTest(10));
  test('test7', timeoutTest(20));
  test('test8', timeoutTest(30));

  var output = har.run({ async: true });
  var index = 1;
  output.on('data', function(info) {
    if (info.type !== TEST_END) {
      return;
    }
    var data = info.data;
    t.equal(data.name, 'test' + index);
    t.ok(data.success);
    index++;
  });
  output.on('end', t.end);
});
