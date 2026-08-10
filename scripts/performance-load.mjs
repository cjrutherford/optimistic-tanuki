#!/usr/bin/env node

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const [name, inlineValue] = value.slice(2).split('=', 2);
  if (inlineValue !== undefined) {
    args.set(name, inlineValue);
    continue;
  }
  const next = process.argv[index + 1];
  if (next && !next.startsWith('--')) {
    args.set(name, next);
    index += 1;
  } else {
    args.set(name, true);
  }
}

const baseUrl = String(args.get('url') || 'http://127.0.0.1:8080');
const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const durationMs = positiveNumber(args.get('duration'), 30) * 1000;
const concurrency = Math.max(
  1,
  Math.floor(positiveNumber(args.get('concurrency'), 10))
);
const path = String(args.get('path') || '/');
const samples = [];
let errors = 0;
let stopped = false;

const worker = async () => {
  while (!stopped) {
    const started = performance.now();
    try {
      const response = await fetch(new URL(path, baseUrl), {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      const elapsed = performance.now() - started;
      if (response.ok || response.status < 500) samples.push(elapsed);
      else errors += 1;
      await response.arrayBuffer();
    } catch {
      errors += 1;
    }
  }
};

const workers = Array.from({ length: concurrency }, () => worker());
await new Promise((resolve) => setTimeout(resolve, durationMs));
stopped = true;
await Promise.all(workers);

samples.sort((a, b) => a - b);
const percentile = (value) =>
  samples.length
    ? samples[
        Math.min(samples.length - 1, Math.ceil(samples.length * value) - 1)
      ]
    : 0;
console.log(
  JSON.stringify(
    {
      url: new URL(path, baseUrl).toString(),
      durationSeconds: durationMs / 1000,
      concurrency,
      requests: samples.length + errors,
      errors,
      p50Ms: Math.round(percentile(0.5)),
      p75Ms: Math.round(percentile(0.75)),
      p95Ms: Math.round(percentile(0.95)),
      errorRate: (errors / Math.max(1, samples.length + errors)).toFixed(4),
    },
    null,
    2
  )
);
