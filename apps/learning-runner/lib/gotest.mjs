/**
 * Formatting and parsing Go test executions.
 *
 * Runs `go test -v .` against a scratch directory containing main.go and
 * main_test.go.
 */

export function buildGoTestSource(testCode) {
  if (!testCode) return '';
  const trimmed = String(testCode).trim();
  if (trimmed.startsWith('package ')) {
    return `${trimmed}\n`;
  }
  return `package main\n\nimport (\n\t"testing"\n)\n\n${trimmed}\n`;
}

export function formatGoTestName(rawName) {
  const parts = String(rawName).split('/');
  return parts
    .map((part) =>
      part
        .replace(/^(?:Test|Benchmark)_?/, '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim()
    )
    .join(' › ');
}

export function parseGoBenchmarkOutput(output) {
  const benchmarks = [];
  for (const raw of String(output ?? '').split('\n')) {
    const line = raw.trim();
    const match =
      /^Benchmark(\S+?)(?:-\d+)?\s+\d+\s+[\d.]+\s+ns\/op(?:\s|$)/.exec(line);
    if (!match) continue;
    benchmarks.push({
      name: match[1],
      status: 'PASS',
    });
  }
  return benchmarks;
}

export function parseGoTestOutput(output) {
  const lines = String(output ?? '').split('\n');
  const outcomes = [];
  const testLogs = new Map();
  const testStack = [];
  let sawSummary = false;
  let passed = 0;
  let failed = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line === 'PASS' || line === 'FAIL' || /^(ok|FAIL)\s+\S+/.test(line)) {
      sawSummary = true;
      continue;
    }

    const runMatch = /^=== RUN\s+(\S+)/.exec(line);
    if (runMatch) {
      const name = runMatch[1];
      testStack.push(name);
      if (!testLogs.has(name)) {
        testLogs.set(name, []);
      }
      continue;
    }

    const outcomeMatch = /^---\s+(PASS|FAIL|SKIP):\s+(\S+)/.exec(line);
    if (outcomeMatch) {
      const status = outcomeMatch[1];
      const name = outcomeMatch[2];
      if (status === 'PASS') passed++;
      if (status === 'FAIL') failed++;
      outcomes.push({ name, status });
      const idx = testStack.lastIndexOf(name);
      if (idx !== -1) testStack.splice(idx, 1);
      continue;
    }

    // Strip file location prefix like "main_test.go:8: "
    const cleaned = line.replace(/^[a-zA-Z0-9_.-]+\.go:\d+:\s*/, '');
    if (testStack.length > 0) {
      const activeTest = testStack[testStack.length - 1];
      testLogs.get(activeTest).push(cleaned);
    }
  }

  return { outcomes, testLogs, sawSummary, passed, failed };
}

export function gotestResults(
  output,
  exitCode,
  compileErrors = [],
  executionMode = 'test'
) {
  const { outcomes, testLogs, sawSummary, passed, failed } =
    parseGoTestOutput(output);
  const benchmarks =
    executionMode === 'benchmark' ? parseGoBenchmarkOutput(output) : [];
  const succeeded = exitCode === 0 && sawSummary && failed === 0;

  if (executionMode === 'benchmark') {
    if (exitCode !== 0 && benchmarks.length === 0) {
      const errorMsg =
        compileErrors.length > 0
          ? compileErrors.join('\n')
          : String(output ?? '').trim() || 'Benchmark failed';
      return {
        testsPassed: false,
        testResults: [
          {
            name: 'Compilation & Build',
            passed: false,
            error: errorMsg,
          },
        ],
      };
    }

    return {
      testsPassed: succeeded && benchmarks.length > 0,
      testResults: benchmarks.map((benchmark) => ({
        name: formatGoTestName(`Benchmark${benchmark.name}`),
        passed: succeeded,
      })),
    };
  }

  if (exitCode !== 0 && (outcomes.length === 0 || !sawSummary)) {
    // Build or panic failure before tests could run
    const errorMsg =
      compileErrors.length > 0
        ? compileErrors.join('\n')
        : String(output ?? '').trim() || 'Compilation failed';
    return {
      testsPassed: false,
      testResults: [
        {
          name: 'Compilation & Build',
          passed: false,
          error: errorMsg,
        },
      ],
    };
  }

  // Filter out parent tests if subtests exist
  const detailedOutcomes = outcomes.filter(
    (outcome) =>
      !outcomes.some((other) => other.name.startsWith(outcome.name + '/'))
  );

  const testResults = detailedOutcomes.map((outcome) => {
    const isOk = outcome.status === 'PASS';
    const logs = testLogs.get(outcome.name) || [];
    return {
      name: formatGoTestName(outcome.name),
      passed: isOk,
      ...(isOk ? {} : { error: logs.join('\n').trim() || 'Assertion failed' }),
    };
  });

  if (testResults.length > 0) {
    return {
      testsPassed: succeeded && passed > 0,
      testResults,
    };
  }

  return {
    testsPassed: succeeded && sawSummary && passed > 0,
    testResults: [
      {
        name: 'test run',
        passed: succeeded && passed > 0,
        error: sawSummary
          ? `${passed} passed, ${failed} failed`
          : 'The tests did not report a result.',
      },
    ],
  };
}
