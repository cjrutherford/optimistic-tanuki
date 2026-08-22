import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const port = Number(process.env.PORT || 3025);
const limits = { timeoutMs: 10_000, maxOutputBytes: 1_048_576 };
const commands = {
  typescript: ['node', ['--experimental-strip-types', 'main.ts']],
  go: ['go', ['run', 'main.go']],
  cpp: ['sh', ['-c', 'g++ -std=c++17 main.cpp -o main && ./main']],
  rust: ['sh', ['-c', 'rustc --edition 2021 main.rs -o main && ./main']],
};
const sourceNames = {
  typescript: 'main.ts',
  go: 'main.go',
  cpp: 'main.cpp',
  rust: 'main.rs',
};
const typescriptHarness = `
const __learningResults = [];
function test(name, fn) { try { fn(); __learningResults.push({ name, passed: true }); } catch (error) { __learningResults.push({ name, passed: false, error: String(error) }); throw error; } }
function expect(actual) { return { toBe(expected) { if (actual !== expected) throw new Error('Expected ' + JSON.stringify(expected) + ', received ' + JSON.stringify(actual)); }, toEqual(expected) { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Values are not equal'); }, toBeTruthy() { if (!actual) throw new Error('Expected a truthy value'); }, toBeFalsy() { if (actual) throw new Error('Expected a falsy value'); } }; }
`;

function execute(languageId, cwd, testMode = false) {
  const command = commands[languageId];
  if (!command)
    return Promise.resolve({
      success: false,
      output: '',
      errors: ['Unsupported language'],
      timedOut: false,
    });
  const executable =
    testMode && languageId === 'rust'
      ? ['rustc', ['--edition', '2021', '--test', 'main.rs', '-o', 'main-test']]
      : command;
  return new Promise((resolve) => {
    const child = spawn(
      'nsjail',
      [
        '--quiet',
        '--clone_newnet',
        '--time_limit',
        '10',
        '--rlimit_as',
        '268435456',
        '--rlimit_nproc',
        '32',
        '--cwd',
        cwd,
        '--',
        executable[0],
        ...executable[1],
      ],
      { cwd, env: { PATH: process.env.PATH } }
    );
    let output = '';
    let errors = '';
    let timedOut = false;
    const collect = (chunk, target) => {
      const text = chunk.toString();
      if (output.length + errors.length < limits.maxOutputBytes) target(text);
    };
    child.stdout.on('data', (chunk) =>
      collect(chunk, (text) => (output += text))
    );
    child.stderr.on('data', (chunk) =>
      collect(chunk, (text) => (errors += text))
    );
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, limits.timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        success: code === 0 && !timedOut,
        output,
        errors: errors ? errors.trim().split('\n') : [],
        timedOut,
      });
    });
  });
}

http
  .createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ok' }));
    }
    if (req.method !== 'POST' || req.url !== '/runs') {
      res.writeHead(404);
      return res.end();
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      const {
        languageId,
        code,
        verifier = {},
        expectedOutput,
      } = JSON.parse(raw);
      if (typeof code !== 'string' || code.length > 50_000)
        throw new Error('Invalid code payload');
      const directory = await mkdtemp(join(tmpdir(), 'learning-run-'));
      try {
        const hasNativeTests =
          Boolean(verifier.testCode) &&
          (languageId === 'typescript' || languageId === 'rust');
        const source =
          languageId === 'typescript' && verifier.testCode
            ? `${typescriptHarness}\n${code}\n${verifier.testCode}`
            : languageId === 'rust' && verifier.testCode
            ? `${code}\n${verifier.testCode}`
            : code;
        await writeFile(join(directory, sourceNames[languageId]), source);
        let result = await execute(
          languageId,
          directory,
          languageId === 'rust' && hasNativeTests
        );
        if (languageId === 'rust' && hasNativeTests && result.success) {
          result = await new Promise((resolve) => {
            const child = spawn(
              'nsjail',
              [
                '--quiet',
                '--clone_newnet',
                '--time_limit',
                '10',
                '--rlimit_as',
                '268435456',
                '--rlimit_nproc',
                '32',
                '--cwd',
                directory,
                '--',
                './main-test',
              ],
              { cwd: directory, env: { PATH: process.env.PATH } }
            );
            let output = '';
            let errors = '';
            child.stdout.on('data', (chunk) => (output += chunk.toString()));
            child.stderr.on('data', (chunk) => (errors += chunk.toString()));
            child.on('close', (exitCode) =>
              resolve({
                success: exitCode === 0,
                output,
                errors: errors ? errors.trim().split('\n') : [],
                timedOut: false,
              })
            );
          });
        }
        const validationPattern = verifier.validationPattern;
        const outputMatches = expectedOutput
          ? result.output.trim() === expectedOutput.trim()
          : true;
        const patternMatches = validationPattern
          ? new RegExp(validationPattern).test(result.output)
          : true;
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            ...result,
            testsPassed: hasNativeTests
              ? result.success
              : result.success && outputMatches && patternMatches,
          })
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
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
