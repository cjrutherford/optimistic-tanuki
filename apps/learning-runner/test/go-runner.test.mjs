import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { once } from 'node:events';
import { spawn } from 'node:child_process';

const SERVER = join(process.cwd(), 'server.mjs');
const PORT = '33101';
const SCRATCH = join(process.cwd(), '.go-runner-test-scratch');

let server;

test.before(async () => {
  await mkdir(SCRATCH, { recursive: true });
  server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT,
      LEARNING_SCRATCH_DIR: SCRATCH,
      LEARNING_RUNNER_TIMEOUT_MS: '7000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error('Go runner did not become healthy');
});

test.after(async () => {
  server.kill('SIGKILL');
  await once(server, 'close');
  await rm(SCRATCH, { recursive: true, force: true });
});

async function post(body) {
  const response = await fetch(`http://127.0.0.1:${PORT}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return await response.json();
}

test('keeps an ordinary Go executable on go run', async () => {
  const result = await post({
    languageId: 'go',
    code: `package main

import "fmt"

func main() {
  fmt.Println("ordinary executable")
}`,
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.testsPassed, true);
  assert.equal(result.output.trim(), 'ordinary executable');
});

test('runs t-01 learner-owned TestAdd without a verifier duplicate', async () => {
  const result = await post({
    languageId: 'go',
    executionMode: 'test',
    code: `package main

import "testing"

func Add(a, b int) int {
  return a + b
}

func TestAdd(t *testing.T) {
  if Add(2, 3) != 5 {
    t.Fatal("expected 5")
  }
}`,
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.testsPassed, true);
  assert.deepEqual(result.testResults, [{ name: 'Add', passed: true }]);
});

test('runs a no-main table test through go test', async () => {
  const result = await post({
    languageId: 'go',
    executionMode: 'test',
    code: `package main

import "testing"

func Add(a, b int) int {
  return a + b
}

func TestAddTable(t *testing.T) {
  cases := []struct {
    name string
    a, b, want int
  }{
    {"positive", 1, 2, 3},
    {"zero", 0, 0, 0},
    {"negative", -1, 1, 0},
    {"larger", 10, 20, 30},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      if got := Add(tc.a, tc.b); got != tc.want {
        t.Fatalf("got %d, want %d", got, tc.want)
      }
    })
  }
}`,
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.testsPassed, true);
  assert.deepEqual(
    result.testResults.map((item) => item.name),
    [
      'Add Table › positive',
      'Add Table › zero',
      'Add Table › negative',
      'Add Table › larger',
    ]
  );
});

test('runs a bounded benchmark through go test', async () => {
  const result = await post({
    languageId: 'go',
    executionMode: 'benchmark',
    code: `package main

import "testing"

func Add(a, b int) int {
  return a + b
}

func BenchmarkAdd(b *testing.B) {
  for i := 0; i < b.N; i++ {
    Add(1, 2)
  }
}`,
  });

  assert.equal(result.success, true, JSON.stringify(result));
  assert.equal(result.testsPassed, true);
  assert.deepEqual(result.testResults, [{ name: 'Add', passed: true }]);
});

test('times out a hanging Go test', async () => {
  const result = await post({
    languageId: 'go',
    executionMode: 'test',
    code: `package main

import "testing"

func TestHang(t *testing.T) {
  for {}
}`,
  });

  assert.equal(result.success, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.testsPassed, false);
  assert.deepEqual(result.testResults, [
    {
      name: 'Timeout',
      passed: false,
      error: 'Go execution exceeded the runner time limit.',
    },
  ]);
});
