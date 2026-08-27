/**
 * The test harness injected ahead of a learner's TypeScript submission.
 *
 * Written as plain JavaScript inside a string so the type stripper never has
 * to parse it, and kept to the matchers the exercises actually use.
 *
 * Results are collected rather than thrown, then written after the marker on
 * exit, so a failing assertion still lets the remaining cases run and the
 * learner sees every failure at once instead of only the first.
 */
export const RESULT_MARKER = '__LEARNING_TEST_RESULTS__';

export const TYPESCRIPT_HARNESS = `;(function () {
  var _results = [];

  function test(name, fn) {
    try { fn(); _results.push({ name: name, passed: true }); }
    catch (e) { _results.push({ name: name, passed: false, error: String(e && e.message ? e.message : e) }); }
  }

  function show(value) {
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }

  function expect(actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected)
          throw new Error('Expected ' + show(expected) + ', received ' + show(actual));
      },
      toEqual: function (expected) {
        if (JSON.stringify(actual) !== JSON.stringify(expected))
          throw new Error('Expected ' + show(expected) + ', received ' + show(actual));
      },
      toBeTruthy: function () {
        if (!actual) throw new Error('Expected truthy, received ' + show(actual));
      },
      toBeFalsy: function () {
        if (actual) throw new Error('Expected falsy, received ' + show(actual));
      },
      toBeNull: function () {
        if (actual !== null) throw new Error('Expected null, received ' + show(actual));
      },
      toBeUndefined: function () {
        if (actual !== undefined) throw new Error('Expected undefined, received ' + show(actual));
      },
      toBeCloseTo: function (expected, digits) {
        var places = digits === undefined ? 2 : digits;
        if (Math.abs(actual - expected) > Math.pow(10, -places) / 2)
          throw new Error('Expected ' + show(actual) + ' to be close to ' + show(expected));
      },
      toContain: function (item) {
        if (Array.isArray(actual)) {
          if (actual.indexOf(item) === -1)
            throw new Error('Expected array to contain ' + show(item));
        } else if (typeof actual === 'string') {
          if (actual.indexOf(String(item)) === -1)
            throw new Error('Expected string to contain ' + show(item));
        } else {
          throw new Error('toContain expects an array or string');
        }
      },
      toHaveLength: function (n) {
        if (!actual || actual.length !== n)
          throw new Error('Expected length ' + n + ', received ' + (actual ? actual.length : show(actual)));
      },
      toThrow: function (substr) {
        if (typeof actual !== 'function') throw new Error('toThrow expects a function');
        var threw = false, message = '';
        try { actual(); } catch (e) { threw = true; message = String(e && e.message ? e.message : e); }
        if (!threw) throw new Error('Expected the function to throw, and it did not');
        if (substr && message.indexOf(substr) === -1)
          throw new Error('Expected an error containing "' + substr + '", got "' + message + '"');
      },
      toHaveBeenCalled: function () {
        if (!actual || typeof actual.callCount !== 'function')
          throw new Error('toHaveBeenCalled expects a spy');
        if (actual.callCount() === 0) throw new Error('Expected the spy to have been called');
      },
      toHaveBeenCalledTimes: function (n) {
        if (!actual || typeof actual.callCount !== 'function')
          throw new Error('toHaveBeenCalledTimes expects a spy');
        var count = actual.callCount();
        if (count !== n)
          throw new Error('Expected ' + n + ' call(s), received ' + count);
      },
      toHaveBeenCalledWith: function () {
        var args = Array.prototype.slice.call(arguments);
        if (!actual || typeof actual.calledWith !== 'function')
          throw new Error('toHaveBeenCalledWith expects a spy');
        if (!actual.calledWith.apply(null, args))
          throw new Error('Expected the spy to have been called with ' + show(args));
      },
    };
  }

  function spy(impl) {
    var calls = [];
    function mock() {
      var args = Array.prototype.slice.call(arguments);
      calls.push(args);
      return impl ? impl.apply(this, args) : undefined;
    }
    mock.calls = calls;
    mock.callCount = function () { return calls.length; };
    mock.calledWith = function () {
      var args = Array.prototype.slice.call(arguments);
      return calls.some(function (c) { return JSON.stringify(c) === JSON.stringify(args); });
    };
    return mock;
  }

  Object.assign(globalThis, { test: test, it: test, expect: expect, spy: spy });

  process.on('exit', function () {
    if (_results.length > 0) {
      process.stdout.write('\\n${RESULT_MARKER}\\n' + JSON.stringify(_results) + '\\n');
    }
  });
})();
`;

/**
 * Splits a run's stdout into what the learner wrote and what the harness
 * reported, so the results payload never leaks into the visible output.
 */
export function splitTestResults(output) {
  const marker = `\n${RESULT_MARKER}\n`;
  const at = output.indexOf(marker);
  if (at === -1) return { output, testResults: [] };

  const visible = output.slice(0, at);
  const payload = output.slice(at + marker.length).trim();
  try {
    const parsed = JSON.parse(payload);
    return {
      output: visible,
      testResults: Array.isArray(parsed) ? parsed : [],
    };
  } catch {
    // A truncated or corrupted payload should not lose the learner's output.
    return { output: visible, testResults: [] };
  }
}

/** True when the harness ran at least one case and none of them failed. */
export function allTestsPassed(testResults) {
  return testResults.length > 0 && testResults.every((result) => result.passed);
}
