import http from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import {
  TYPESCRIPT_HARNESS,
  splitTestResults,
  allTestsPassed,
} from './lib/typescript-harness.mjs';
import { CATCH2_DIR, catch2Available, catch2Results } from './lib/catch2.mjs';
import {
  buildSource,
  GO_EXECUTION_MODES,
  prepare,
  TYPESCRIPT_COMPILER_CONFIG,
  TYPESCRIPT_CONFIG_FILE,
  verdict,
} from './lib/run-plan.mjs';
import { libtestResults } from './lib/libtest.mjs';
import { buildGoTestSource, gotestResults } from './lib/gotest.mjs';

const port = Number(process.env.PORT || 3025);
const require = createRequire(import.meta.url);

function resolveTypeScriptCompiler() {
  const configured = process.env.LEARNING_TYPESCRIPT_COMPILER;
  if (configured) return configured;
  try {
    return require.resolve('typescript/lib/tsc.js');
  } catch {
    return null;
  }
}

const typescriptCompiler = resolveTypeScriptCompiler();
const typescriptCompilerError =
  typescriptCompiler && existsSync(typescriptCompiler)
    ? null
    : 'TypeScript compiler is unavailable; the runner cannot execute TypeScript challenges.';

if (typescriptCompilerError) {
  console.error(typescriptCompilerError);
}

/**
 * Where compiled work goes.
 *
 * It has to be a mount that allows exec: C++ and Rust compile a binary and
 * then run it. The container keeps /tmp noexec, so a separate scratch mount is
 * pointed here instead.
 */
const scratchRoot = process.env.LEARNING_SCRATCH_DIR || tmpdir();
const configuredTimeoutMs = Number(process.env.LEARNING_RUNNER_TIMEOUT_MS);
const limits = {
  timeoutMs:
    Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0
      ? Math.min(configuredTimeoutMs, 10_000)
      : 10_000,
  maxOutputBytes: 1_048_576,
};
const configuredCompileTimeoutMs = Number(
  process.env.LEARNING_RUNNER_COMPILE_TIMEOUT_MS
);
const compileTimeoutMs =
  Number.isFinite(configuredCompileTimeoutMs) && configuredCompileTimeoutMs > 0
    ? Math.min(configuredCompileTimeoutMs, 60_000)
    : 30_000;
const configuredProcessLimit = Number(
  process.env.LEARNING_RUNNER_PROCESS_LIMIT
);
const configuredCpuLimitSeconds = Number(
  process.env.LEARNING_RUNNER_CPU_LIMIT_SECONDS
);
const processLimit =
  Number.isInteger(configuredProcessLimit) && configuredProcessLimit > 0
    ? Math.min(configuredProcessLimit, 32)
    : 32;
const cpuLimitSeconds =
  Number.isInteger(configuredCpuLimitSeconds) && configuredCpuLimitSeconds > 0
    ? Math.min(configuredCpuLimitSeconds, 10)
    : undefined;
const constrainedGoBuild = process.env.LEARNING_RUNNER_GO_CONCURRENCY === '1';

const sourceNames = {
  typescript: 'main.ts',
  go: 'main.go',
  cpp: 'main.cpp',
  rust: 'main.rs',
};

function readGoExecutionMode(verifier) {
  const mode = verifier?.executionMode ?? 'run';
  if (!GO_EXECUTION_MODES.includes(mode)) {
    throw new Error(`Unsupported Go execution mode: ${mode}`);
  }
  return mode;
}

/**
 * The container is the sandbox.
 *
 * This used to wrap every command in nsjail, which never once worked: the
 * flag it passed, --clone_newnet, is not an nsjail option at all, so every
 * run failed before reaching a compiler. Removing the flag only exposed the
 * deeper problem, that the container drops every capability and forbids new
 * privileges, so nsjail cannot create namespaces either. The two hardening
 * strategies contradicted each other and the weaker one silently won.
 *
 * What actually contains the code is the container itself, and it is not
 * thin: no capabilities, no new privileges, a read-only root filesystem, no
 * network at all, a memory cap, a process cap, and a scratch mount wiped
 * between runs. The limits below sit on top of that.
 *
 * Toolchains need somewhere to write: Go wants a build cache and rustc wants
 * a home. Both are pointed at the scratch mount, since the root is read-only.
 */
function sandboxed(
  command,
  args,
  cwd,
  tempRoot,
  { timeoutMs = limits.timeoutMs, applyCpuLimit = false } = {}
) {
  return new Promise((resolve) => {
    // Compose/Kubernetes enforce the cgroup memory and process ceilings. This
    // process-group monitor is the application-level backstop for runtimes
    // where Kubernetes cannot express a pod-level pids limit.
    const limitCommands = [];
    const limitValues = [];
    if (applyCpuLimit && cpuLimitSeconds !== undefined) {
      limitCommands.push('ulimit -t "$1" 2>/dev/null || exit 126');
      limitValues.push(String(cpuLimitSeconds));
    }
    limitCommands.push(`shift ${limitValues.length}; exec "$@"`);

    const child = spawn(
      '/bin/sh',
      [
        '-c',
        limitCommands.join('; '),
        'learning-runner',
        ...limitValues,
        command,
        ...args,
      ],
      {
        cwd,
        env: {
          PATH: process.env.PATH,
          HOME: cwd,
          GOCACHE: `${cwd}/.gocache`,
          GOPATH: `${cwd}/.gopath`,
          GOFLAGS: constrainedGoBuild ? '-mod=mod -p=1' : '-mod=mod',
          GOMAXPROCS: constrainedGoBuild ? '1' : process.env.GOMAXPROCS,
          ...(constrainedGoBuild ? { GOMEMLIMIT: '180MiB', GOGC: '20' } : {}),
          TMPDIR: tempRoot,
        },
        detached: true,
      }
    );

    let output = '';
    let errors = '';
    let timedOut = false;
    let processLimitExceeded = false;

    const processGroupSize = () => {
      let count = 0;
      for (const entry of readdirSync('/proc')) {
        if (!/^\d+$/.test(entry)) continue;
        try {
          const stat = readFileSync(`/proc/${entry}/stat`, 'utf8');
          const closingParen = stat.lastIndexOf(')');
          const fields = stat.slice(closingParen + 2).split(' ');
          if (fields[2] === String(child.pid)) count++;
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      return count;
    };

    const killProcessGroup = () => {
      if (!child.pid) return;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    };

    const processMonitor = setInterval(() => {
      try {
        if (processGroupSize() > processLimit) {
          processLimitExceeded = true;
          killProcessGroup();
        }
      } catch (error) {
        processLimitExceeded = true;
        errors += `Process monitor failed closed: ${error.message}\n`;
        killProcessGroup();
      }
    }, 50);

    const collect = (chunk, append) => {
      const remaining = limits.maxOutputBytes - output.length - errors.length;
      if (remaining <= 0) return;
      append(chunk.toString().slice(0, remaining));
    };
    child.stdout.on('data', (c) => collect(c, (t) => (output += t)));
    child.stderr.on('data', (c) => collect(c, (t) => (errors += t)));

    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup();
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      clearInterval(processMonitor);
      resolve({
        exitCode: code,
        success: code === 0 && !timedOut && !processLimitExceeded,
        output,
        errors: errors
          ? errors.trim().split('\n')
          : processLimitExceeded
          ? ['Process limit exceeded.']
          : [],
        timedOut,
      });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      clearInterval(processMonitor);
      resolve({
        exitCode: -1,
        success: false,
        output: '',
        errors: [error.message],
        timedOut: false,
      });
    });
  });
}

/** Compiles when the language needs it, then runs, in the sandbox. */
async function execute(languageId, cwd, executionMode, tempRoot) {
  if (languageId === 'typescript' && typescriptCompilerError) {
    return {
      success: false,
      output: '',
      errors: [typescriptCompilerError],
      timedOut: false,
      exitCode: -1,
      failureStage: 'compile',
    };
  }

  const steps = prepare(
    languageId,
    executionMode,
    CATCH2_DIR,
    typescriptCompiler ?? undefined
  );
  if (!steps) {
    return {
      success: false,
      output: '',
      errors: [`Unsupported language: ${languageId}`],
      timedOut: false,
      exitCode: -1,
    };
  }

  for (const step of steps.compile) {
    const built = await sandboxed(step[0], step.slice(1), cwd, tempRoot, {
      timeoutMs: compileTimeoutMs,
    });
    if (!built.success) {
      return {
        ...built,
        ...(languageId === 'typescript' ? { failureStage: 'compile' } : {}),
        // Compilers write diagnostics to stderr; keep them as the errors.
        errors: built.errors.length
          ? built.errors
          : built.output.trim().split('\n').filter(Boolean),
        output: '',
      };
    }
  }

  const result = await sandboxed(
    steps.run[0],
    steps.run.slice(1),
    cwd,
    tempRoot,
    { applyCpuLimit: true }
  );
  return {
    ...result,
    ...(languageId === 'typescript' && !result.success
      ? { failureStage: 'runtime' }
      : {}),
  };
}

/**
 * Names an exercise may write beside the learner's code.
 *
 * A name is a filename in the run directory and nothing else. Anything with a
 * separator, a drive, or a parent segment is refused, because a run directory
 * that can be escaped is not a run directory. The extension list keeps this to
 * source files rather than, say, a shell profile a toolchain might read.
 */
const SUPPORTING_FILE_NAME = /^[A-Za-z0-9._-]+$/;
const SUPPORTING_FILE_EXTENSIONS = ['.ts', '.go', '.rs', '.cpp', '.h', '.hpp'];

function validateSupportingFiles(files, entryPoint) {
  const entries = Object.entries(files);
  if (entries.length > 10) {
    throw new Error('Too many supporting files');
  }
  for (const [name, contents] of entries) {
    if (!SUPPORTING_FILE_NAME.test(name) || name === '.' || name === '..') {
      throw new Error(`Unsafe supporting file name: ${name}`);
    }
    if (!SUPPORTING_FILE_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      throw new Error(`Unsupported supporting file type: ${name}`);
    }
    if (name === entryPoint) {
      // Otherwise a supporting file could quietly replace the learner's work
      // and the exercise would grade something they never wrote.
      throw new Error(`A supporting file may not replace ${entryPoint}`);
    }
    if (typeof contents !== 'string' || contents.length > 50_000) {
      throw new Error(`Invalid contents for ${name}`);
    }
  }
  return entries;
}

async function handleRun(payload) {
  const {
    languageId,
    code,
    verifier = {},
    executionMode,
    expectedOutput,
    supportingFiles = {},
  } = payload;

  if (typeof code !== 'string' || code.length > 50_000) {
    throw new Error('Invalid code payload');
  }
  if (!sourceNames[languageId]) {
    throw new Error(`Unsupported language: ${languageId}`);
  }
  if (supportingFiles === null || typeof supportingFiles !== 'object') {
    throw new Error('Invalid supporting files');
  }

  const testCode = verifier.testCode;
  const wantsCppTests = Boolean(testCode) && languageId === 'cpp';
  const goMode =
    languageId === 'go'
      ? readGoExecutionMode(
          executionMode === undefined
            ? verifier
            : { ...verifier, executionMode }
        )
      : 'run';
  if (languageId === 'go' && goMode === 'run' && testCode) {
    throw new Error('Go verifier test code requires test or benchmark mode');
  }
  const goTestMode = languageId === 'go' && goMode !== 'run';
  const learnerEntryPoint =
    languageId === 'go' && goTestMode && !testCode
      ? 'main_test.go'
      : sourceNames[languageId];
  const supporting = validateSupportingFiles(
    supportingFiles,
    learnerEntryPoint
  );

  // C++ tests need the pre-compiled Catch2 the image builds. Say so plainly
  // rather than failing with a compiler error about a missing header.
  if (wantsCppTests && !(await catch2Available())) {
    return {
      success: false,
      output: '',
      errors: [
        'C++ tests are unavailable: this runner has no pre-compiled Catch2.',
      ],
      timedOut: false,
      testsPassed: false,
      testResults: [],
    };
  }

  const testMode =
    languageId === 'go'
      ? goTestMode
      : Boolean(testCode) &&
        (languageId === 'typescript' ||
          languageId === 'rust' ||
          languageId === 'cpp');

  const directory = await mkdtemp(join(scratchRoot, 'learning-run-'));
  const tempRoot = await mkdtemp(join(scratchRoot, 'learning-tmp-'));
  try {
    if (languageId === 'go') {
      await writeFile(
        join(directory, 'go.mod'),
        'module learning\n\ngo 1.22\n'
      );
    }

    // Supporting files first, so the entry point can import them. They are
    // written verbatim: they belong to the exercise, not to the learner, and
    // no harness is spliced into them.
    for (const [name, contents] of supporting) {
      await writeFile(join(directory, name), contents);
    }

    if (languageId === 'typescript') {
      await writeFile(
        join(directory, TYPESCRIPT_CONFIG_FILE),
        JSON.stringify(TYPESCRIPT_COMPILER_CONFIG)
      );
    }

    await writeFile(
      join(directory, learnerEntryPoint),
      buildSource(languageId, code, testCode, TYPESCRIPT_HARNESS)
    );

    if (goTestMode && testCode) {
      await writeFile(
        join(directory, 'main_test.go'),
        buildGoTestSource(testCode)
      );
    }

    const result = await execute(
      languageId,
      directory,
      languageId === 'go' ? goMode : testMode,
      tempRoot
    );

    if (testMode && languageId === 'typescript') {
      const { output, testResults } = splitTestResults(result.output);
      if (!result.success && testResults.length === 0) {
        return {
          ...result,
          output,
          testResults: [
            {
              name:
                result.failureStage === 'compile'
                  ? 'Compilation & Build'
                  : 'Runtime Error',
              passed: false,
              error:
                result.errors.join('\n') ||
                'The TypeScript process failed without a diagnostic.',
            },
          ],
          testsPassed: false,
        };
      }
      return {
        ...result,
        output,
        testResults,
        testsPassed: result.success && allTestsPassed(testResults),
      };
    }

    if (testMode && languageId === 'cpp') {
      const { testsPassed, testResults } = catch2Results(
        result.output,
        result.exitCode
      );
      return { ...result, testResults, testsPassed };
    }

    if (testMode && languageId === 'rust') {
      // rustc --test builds libtest's harness, so the exit code is already the
      // verdict. Parsing names which test failed and why, which a non-zero
      // exit on its own does not.
      const { testsPassed, testResults } = libtestResults(
        result.output,
        result.exitCode
      );
      return { ...result, testResults, testsPassed };
    }

    if (goTestMode) {
      if (result.timedOut) {
        return {
          ...result,
          testsPassed: false,
          testResults: [
            {
              name: 'Timeout',
              passed: false,
              error: 'Go execution exceeded the runner time limit.',
            },
          ],
        };
      }
      const { testsPassed, testResults } = gotestResults(
        result.output,
        result.exitCode,
        result.errors,
        goMode
      );
      return { ...result, testResults, testsPassed };
    }

    return {
      ...result,
      testResults: [],
      testsPassed: verdict(result, expectedOutput, verifier.validationPattern),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(tempRoot, { recursive: true, force: true });
  }
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(
        JSON.stringify({
          status: 'ok',
          cpp: await catch2Available(),
          typescript: !typescriptCompilerError,
        })
      );
    }
    if (req.method !== 'POST' || req.url !== '/runs') {
      res.writeHead(404);
      return res.end();
    }

    let raw = '';
    for await (const chunk of req) raw += chunk;

    try {
      const result = await handleRun(JSON.parse(raw));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          success: false,
          output: '',
          errors: [error.message],
          timedOut: false,
        })
      );
    }
  })
  .listen(port, '0.0.0.0');
