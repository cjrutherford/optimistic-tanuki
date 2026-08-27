import http from 'node:http';
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
import { buildSource, prepare, verdict } from './lib/run-plan.mjs';
import { libtestResults } from './lib/libtest.mjs';

const port = Number(process.env.PORT || 3025);

/**
 * Where compiled work goes.
 *
 * It has to be a mount that allows exec: C++ and Rust compile a binary and
 * then run it. The container keeps /tmp noexec, so a separate scratch mount is
 * pointed here instead.
 */
const scratchRoot = process.env.LEARNING_SCRATCH_DIR || tmpdir();
const limits = { timeoutMs: 10_000, maxOutputBytes: 1_048_576 };

const sourceNames = {
  typescript: 'main.ts',
  go: 'main.go',
  cpp: 'main.cpp',
  rust: 'main.rs',
};

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
function sandboxed(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        PATH: process.env.PATH,
        HOME: cwd,
        GOCACHE: `${cwd}/.gocache`,
        GOPATH: `${cwd}/.gopath`,
        GOFLAGS: '-mod=mod',
        TMPDIR: cwd,
      },
    });

    let output = '';
    let errors = '';
    let timedOut = false;

    const collect = (chunk, append) => {
      if (output.length + errors.length < limits.maxOutputBytes) {
        append(chunk.toString());
      }
    };
    child.stdout.on('data', (c) => collect(c, (t) => (output += t)));
    child.stderr.on('data', (c) => collect(c, (t) => (errors += t)));

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, limits.timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code,
        success: code === 0 && !timedOut,
        output,
        errors: errors ? errors.trim().split('\n') : [],
        timedOut,
      });
    });
    child.on('error', (error) => {
      clearTimeout(timer);
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
async function execute(languageId, cwd, testMode) {
  const steps = prepare(languageId, testMode, CATCH2_DIR);
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
    const built = await sandboxed(step[0], step.slice(1), cwd);
    if (!built.success) {
      return {
        ...built,
        // Compilers write diagnostics to stderr; keep them as the errors.
        errors: built.errors.length
          ? built.errors
          : built.output.trim().split('\n').filter(Boolean),
        output: '',
      };
    }
  }

  return await sandboxed(steps.run[0], steps.run.slice(1), cwd);
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
  const supporting = validateSupportingFiles(
    supportingFiles,
    sourceNames[languageId]
  );

  const testCode = verifier.testCode;
  const wantsCppTests = Boolean(testCode) && languageId === 'cpp';

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
    Boolean(testCode) &&
    (languageId === 'typescript' ||
      languageId === 'rust' ||
      languageId === 'cpp');

  const directory = await mkdtemp(join(scratchRoot, 'learning-run-'));
  try {
    // Supporting files first, so the entry point can import them. They are
    // written verbatim: they belong to the exercise, not to the learner, and
    // no harness is spliced into them.
    for (const [name, contents] of supporting) {
      await writeFile(join(directory, name), contents);
    }

    await writeFile(
      join(directory, sourceNames[languageId]),
      buildSource(languageId, code, testCode, TYPESCRIPT_HARNESS)
    );

    const result = await execute(languageId, directory, testMode);

    if (testMode && languageId === 'typescript') {
      const { output, testResults } = splitTestResults(result.output);
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

    return {
      ...result,
      testResults: [],
      testsPassed: verdict(result, expectedOutput, verifier.validationPattern),
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(
        JSON.stringify({ status: 'ok', cpp: await catch2Available() })
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
