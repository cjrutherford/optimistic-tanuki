import { parseCompilerErrors } from './code-diagnostics';

describe('parseCompilerErrors', () => {
  it('places a Go error on its line and column', () => {
    expect(parseCompilerErrors(['./main.go:6:2: undefined: foo'])).toEqual([
      { line: 6, column: 2, message: 'undefined: foo', severity: 'error' },
    ]);
  });

  it('places a C++ error and strips the error label', () => {
    expect(
      parseCompilerErrors([
        "main.cpp:4:5: error: 'x' was not declared in this scope",
      ])
    ).toEqual([
      {
        line: 4,
        column: 5,
        message: "'x' was not declared in this scope",
        severity: 'error',
      },
    ]);
  });

  it('keeps a C++ warning as a warning', () => {
    const [first] = parseCompilerErrors([
      'main.cpp:9:1: warning: unused variable',
    ]);
    expect(first.severity).toBe('warning');
  });

  // Rust splits the message and the position across two lines.
  it('joins a Rust message to the position on the following line', () => {
    expect(
      parseCompilerErrors([
        'error[E0425]: cannot find value `x` in this scope',
        ' --> main.rs:3:5',
      ])
    ).toEqual([
      {
        line: 3,
        column: 5,
        message: 'cannot find value `x` in this scope',
        severity: 'error',
      },
    ]);
  });

  it('reads a position out of a node stack frame', () => {
    const [first] = parseCompilerErrors([
      'ReferenceError: x is not defined',
      '    at file:///tmp/learning-run-a1/main.ts:3:9',
    ]);
    expect(first).toEqual({
      line: 3,
      column: 9,
      message: 'ReferenceError: x is not defined',
      severity: 'error',
    });
  });

  it('pins a message with no coordinates to the first line rather than dropping it', () => {
    expect(parseCompilerErrors(['error: linking failed'])).toEqual([
      { line: 1, column: 1, message: 'linking failed', severity: 'error' },
    ]);
  });

  it('handles several errors in one run', () => {
    const found = parseCompilerErrors([
      './main.go:3:2: undefined: a',
      './main.go:7:9: undefined: b',
    ]);
    expect(found).toHaveLength(2);
    expect(found.map((d) => d.line)).toEqual([3, 7]);
  });

  it('ignores blank lines and unlabelled noise', () => {
    expect(
      parseCompilerErrors(['', '   ', 'Compiling playground v0.1.0'])
    ).toEqual([]);
  });

  it('returns nothing for no errors', () => {
    expect(parseCompilerErrors([])).toEqual([]);
  });
});
