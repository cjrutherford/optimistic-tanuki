import { cppCompileCommand } from './catch2.mjs';

export const TYPESCRIPT_CONFIG_FILE = 'tsconfig.runner.json';

export const TYPESCRIPT_COMPILER_CONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'CommonJS',
    moduleResolution: 'Node',
    skipLibCheck: true,
    sourceMap: true,
    rewriteRelativeImportExtensions: true,
    noEmitOnError: true,
    pretty: false,
    outDir: 'compiled',
    types: [],
  },
  files: ['main.ts'],
};

export const GO_EXECUTION_MODES = ['run', 'test', 'benchmark'];

function isTestMode(executionMode) {
  return executionMode === true || executionMode === 'test';
}

/**
 * What to compile and what to run, per language.
 *
 * Kept apart from the sandbox so the decisions can be tested without needing
 * a compiler on the machine running the tests.
 */
export function prepare(
  languageId,
  executionMode = 'run',
  catch2Dir,
  typescriptCompilerPath = 'node_modules/typescript/lib/tsc.js'
) {
  switch (languageId) {
    case 'typescript':
      return {
        compile: [
          ['node', typescriptCompilerPath, '--project', TYPESCRIPT_CONFIG_FILE],
        ],
        run: ['node', '--enable-source-maps', 'compiled/main.js'],
      };

    case 'go':
      switch (executionMode) {
        case true:
        case 'test':
          return {
            compile: [['go', 'test', '-c', '-o', 'main.test', '.']],
            run: [
              './main.test',
              '-test.v',
              '-test.run',
              '^Test',
              '-test.count=1',
            ],
          };
        case 'benchmark':
          return {
            compile: [['go', 'test', '-c', '-o', 'main.test', '.']],
            run: [
              './main.test',
              '-test.v',
              '-test.run',
              '^$',
              '-test.bench',
              '^Benchmark',
              '-test.benchtime=100ms',
              '-test.count=1',
            ],
          };
        default:
          return {
            compile: [['go', 'build', '-o', 'main', 'main.go']],
            run: ['./main'],
          };
      }

    case 'rust':
      return isTestMode(executionMode)
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
            test: isTestMode(executionMode),
            dir: catch2Dir,
          }),
        ],
        // The compact reporter is terser than the default and easier to read
        // back, which is what parseCatch2Output expects.
        run: isTestMode(executionMode)
          ? ['./main', '--reporter', 'compact']
          : ['./main'],
      };

    default:
      return null;
  }
}

/**
 * The learner source handed to the compiler. Go test and benchmark source is
 * placed in a _test.go file by the server, so the Go tool recognizes it.
 *
 * Test code goes after the learner's code in every language, because each one
 * needs the definitions above the assertions that use them.
 */
export function buildSource(languageId, code, testCode, typescriptHarness) {
  if (!testCode) return code;

  switch (languageId) {
    case 'typescript':
      return `${code}\n${typescriptHarness}\n${testCode}`;
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
