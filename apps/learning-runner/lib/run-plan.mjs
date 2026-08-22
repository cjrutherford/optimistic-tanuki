import { cppCompileCommand } from './catch2.mjs';

/**
 * What to compile and what to run, per language.
 *
 * Kept apart from the sandbox so the decisions can be tested without needing
 * nsjail or a compiler on the machine running the tests.
 */
export function prepare(languageId, testMode, catch2Dir) {
  switch (languageId) {
    case 'typescript':
      return {
        compile: [],
        run: ['node', '--experimental-strip-types', 'main.ts'],
      };

    case 'go':
      return { compile: [], run: ['go', 'run', 'main.go'] };

    case 'rust':
      return testMode
        ? {
            compile: [
              ['rustc', '--edition', '2021', '--test', 'main.rs', '-o', 'main'],
            ],
            run: ['./main'],
          }
        : {
            compile: [['rustc', '--edition', '2021', 'main.rs', '-o', 'main']],
            run: ['./main'],
          };

    case 'cpp':
      return {
        compile: [
          cppCompileCommand({
            source: 'main.cpp',
            output: 'main',
            test: testMode,
            dir: catch2Dir,
          }),
        ],
        // The compact reporter is terser than the default and easier to read
        // back, which is what parseCatch2Output expects.
        run: testMode ? ['./main', '--reporter', 'compact'] : ['./main'],
      };

    default:
      return null;
  }
}

/**
 * The single file handed to the compiler.
 *
 * Test code goes after the learner's code in every language, because each one
 * needs the definitions above the assertions that use them.
 */
export function buildSource(languageId, code, testCode, typescriptHarness) {
  if (!testCode) return code;

  switch (languageId) {
    case 'typescript':
      return `${typescriptHarness}\n${code}\n${testCode}`;
    case 'rust':
    case 'cpp':
      return `${code}\n\n${testCode}`;
    default:
      return code;
  }
}

/**
 * Whether a plain run counts as correct, judged on its output.
 *
 * Used only when an exercise carries no test code of its own.
 */
export function verdict(result, expectedOutput, validationPattern) {
  if (!result.success) return false;

  if (expectedOutput && result.output.trim() !== expectedOutput.trim()) {
    return false;
  }
  if (validationPattern && !new RegExp(validationPattern).test(result.output)) {
    return false;
  }
  return true;
}
