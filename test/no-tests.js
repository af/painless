var tap = require('tap')
var assert = require('chai').assert;
var painless = require('../');
var test = tap.test;

test('no tests', function(t) {
  var harness = painless.createHarness({ exit: false });
  var stream = harness.createStream();
  var body = [];
  stream.on('data', function(result) {
    body.push(result);
  });
  stream.on('end', function() {
    assert.deepEqual([
      'TAP version 13\n',
      '\n1..0\n',
      '# tests 0\n',
      '# pass  0\n',
      '\n# ok\n'
    ], body);
    t.end();
  });
});
