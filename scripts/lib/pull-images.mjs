#!/usr/bin/env node
/**
 * Pull a list of images concurrently through the Docker Engine API and render a
 * live dashboard.
 *
 * Images are read from stdin, one per line:
 *   printf '%s\n' img1 img2 | node scripts/lib/pull-images.mjs --concurrency 3
 *
 * The dashboard is written to the controlling terminal, so it still updates in
 * place when this script's stdout is piped into a deploy log. Persistent lines
 * (completed/failed images) go to stdout for the log. DOCKER_PULL_PROGRESS=off
 * disables the dashboard.
 */

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyMessage,
  createProgress,
  formatDuration,
  overallLine,
  preparingLine,
  progressBar,
  shortName,
  statusLine,
  summarize,
} from './pull-progress.mjs';

const MAX_VISIBLE = 5;

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayWithSignal(ms, signal) {
  if (!signal) {
    return sleep(ms);
  }
  if (signal.aborted) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}

/**
 * Run tasks with bounded concurrency and per-task retries.
 *
 * Exported for tests; the CLI below supplies the real pull implementation.
 */
export async function runPool(tasks, options) {
  const {
    concurrency = 3,
    retries = 3,
    retryDelay = 15,
    pullOnce,
    onStart = () => {},
    onRetry = () => {},
    onResult = () => {},
    onUpdate = () => {},
    abortController,
  } = options;

  let next = 0;
  let activeCount = 0;
  let failed = false;
  const results = [];
  const signal = abortController?.signal;

  return new Promise((resolve) => {
    const maybeResolve = () => {
      if (activeCount === 0 && (failed || next >= tasks.length)) {
        resolve({ ok: !failed, results });
      }
    };

    const attempt = async (task, attemptNumber) => {
      let result;
      try {
        result = await pullOnce(task, { attempt: attemptNumber, signal });
      } catch (error) {
        result = { ok: false, message: error?.message || String(error) };
      }

      if (
        !result.ok &&
        !result.aborted &&
        attemptNumber <= retries &&
        !failed
      ) {
        onRetry(task, {
          attempt: attemptNumber,
          delay: retryDelay,
          message: result.message,
        });
        await delayWithSignal(retryDelay * 1000, signal);
        if (!failed) {
          attempt(task, attemptNumber + 1);
          return;
        }
        result = {
          ok: false,
          aborted: true,
          message: 'aborted',
          seconds: result.seconds,
        };
      }

      activeCount -= 1;
      task.active = false;
      if (!result.ok && !result.aborted) {
        failed = true;
      }
      results.push({ task, ...result });
      onResult(task, result);

      if (failed && abortController) {
        abortController.abort();
      }
      onUpdate(true);
      pump();
      maybeResolve();
    };

    const pump = () => {
      while (!failed && activeCount < concurrency && next < tasks.length) {
        const task = tasks[next];
        next += 1;
        activeCount += 1;
        task.active = true;
        onStart(task);
        attempt(task, 1);
      }
      maybeResolve();
    };

    pump();
  });
}

function splitRef(ref) {
  const at = ref.indexOf('@');
  if (at >= 0) {
    return { repo: ref.slice(0, at), digest: ref.slice(at + 1), tag: '' };
  }
  const slash = ref.lastIndexOf('/');
  const colon = ref.lastIndexOf(':');
  if (colon > slash) {
    return { repo: ref.slice(0, colon), tag: ref.slice(colon + 1) };
  }
  return { repo: ref, tag: 'latest' };
}

function loadAuthConfig(repo) {
  const configPath = process.env.DOCKER_CONFIG
    ? path.join(process.env.DOCKER_CONFIG, 'config.json')
    : path.join(os.homedir(), '.docker', 'config.json');

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return null;
  }

  const auths = config.auths || {};
  const first = repo.split('/')[0];
  const isRegistry =
    first.includes('.') || first.includes(':') || first === 'localhost';
  const server = isRegistry ? first : 'https://index.docker.io/v1/';

  let entry;
  for (const key of [server, `https://${server}`, `https://${server}/v1/`]) {
    if (auths[key]?.auth) {
      entry = auths[key];
      break;
    }
  }
  if (!entry?.auth) {
    return null;
  }

  const decoded = Buffer.from(entry.auth, 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator < 0) {
    return null;
  }
  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
    serveraddress: server,
  };
}

function createPullOnce({ socketPath, onProgress }) {
  return (task, { signal }) =>
    new Promise((resolve) => {
      let settled = false;
      const done = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      const state = task.state;
      state.layers.clear();
      state.error = null;
      state.upToDate = false;
      state.statusText = '';
      state.queued = 0;
      state.downloaded = 0;
      state.extracted = 0;

      const attemptStarted = Date.now();
      const { repo, digest, tag } = splitRef(task.image);
      const query = digest
        ? `fromImage=${encodeURIComponent(`${repo}@${digest}`)}`
        : `fromImage=${encodeURIComponent(repo)}&tag=${encodeURIComponent(
            tag
          )}`;

      const headers = {};
      const auth = loadAuthConfig(repo);
      if (auth) {
        headers['X-Registry-Auth'] = Buffer.from(JSON.stringify(auth)).toString(
          'base64url'
        );
      }

      const request = http.request(
        {
          socketPath,
          method: 'POST',
          path: `/images/create?${query}`,
          headers,
        },
        (response) => {
          if (response.statusCode !== 200) {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', (chunk) => {
              body += chunk;
            });
            response.on('end', () => {
              done({
                ok: false,
                message: `HTTP ${response.statusCode}: ${
                  body.trim() || 'pull failed'
                }`,
                seconds: (Date.now() - attemptStarted) / 1000,
              });
            });
            return;
          }

          let buffer = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            buffer += chunk;
            let newline;
            while ((newline = buffer.indexOf('\n')) >= 0) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line) {
                continue;
              }
              let message;
              try {
                message = JSON.parse(line);
              } catch {
                continue;
              }
              applyMessage(state, message);
              if (state.error) {
                request.destroy();
                done({
                  ok: false,
                  message: state.error,
                  seconds: (Date.now() - attemptStarted) / 1000,
                });
                return;
              }
              onProgress(task);
            }
          });

          response.on('end', () => {
            if (buffer.trim()) {
              try {
                applyMessage(state, JSON.parse(buffer.trim()));
              } catch {
                // Ignore a truncated trailing fragment.
              }
            }
            const seconds = (Date.now() - attemptStarted) / 1000;
            if (state.error) {
              done({ ok: false, message: state.error, seconds });
            } else {
              done({ ok: true, upToDate: state.upToDate, seconds });
            }
          });
        }
      );

      request.on('error', (error) => {
        done({
          ok: false,
          aborted: Boolean(signal?.aborted),
          message: error.message,
          seconds: (Date.now() - attemptStarted) / 1000,
        });
      });

      if (signal) {
        if (signal.aborted) {
          request.destroy();
          done({ ok: false, aborted: true, message: 'aborted', seconds: 0 });
          return;
        }
        signal.addEventListener(
          'abort',
          () => {
            request.destroy();
            done({ ok: false, aborted: true, message: 'aborted', seconds: 0 });
          },
          { once: true }
        );
      }

      request.end();
    });
}

async function readImages() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks)
    .toString('utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function main() {
  const argv = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && index + 1 < argv.length ? argv[index + 1] : fallback;
  };

  const concurrency = Math.max(1, Number(option('concurrency', '3')) || 3);
  const retries = Math.max(0, Number(option('retries', '3')) || 0);
  const retryDelay = Math.max(0, Number(option('retry-delay', '15')) || 0);
  const socketPath =
    option('socket') || process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  const progressEnabled =
    (process.env.DOCKER_PULL_PROGRESS || 'auto') !== 'off';

  const images = await readImages();
  if (images.length === 0) {
    process.stderr.write('pull-images: no images on stdin\n');
    process.exit(2);
  }

  const started = Date.now();
  const tasks = images.map((image, index) => ({
    image,
    index: index + 1,
    total: images.length,
    state: createProgress(image, index + 1, images.length),
    active: false,
    finished: false,
    retryAt: 0,
    startedAt: 0,
    lastTotal: 0,
    totalSince: 0,
  }));

  let completed = 0;
  let blockLines = 0;
  let lastDraw = 0;
  let lastPlain = 0;
  let done = false;

  let tty = null;
  if (progressEnabled) {
    try {
      tty = fs.openSync('/dev/tty', 'w');
    } catch {
      tty = null;
    }
  }

  function clearBlock() {
    if (!tty || blockLines === 0) {
      return;
    }
    fs.writeSync(tty, `\x1b[${blockLines}A`);
    for (let i = 0; i < blockLines; i += 1) {
      fs.writeSync(tty, '\x1b[2K\n');
    }
    fs.writeSync(tty, `\x1b[${blockLines}A`);
    blockLines = 0;
  }

  function drawBlock(lines) {
    if (!tty) {
      return;
    }
    const previous = blockLines;
    if (previous > 0) {
      fs.writeSync(tty, `\x1b[${previous}A`);
      for (let i = 0; i < previous; i += 1) {
        fs.writeSync(tty, '\x1b[2K\n');
      }
      fs.writeSync(tty, `\x1b[${previous}A`);
    }
    for (const line of lines) {
      fs.writeSync(tty, `\x1b[2K${line}\n`);
    }
    if (lines.length < previous) {
      const extra = previous - lines.length;
      for (let i = 0; i < extra; i += 1) {
        fs.writeSync(tty, '\x1b[2K\n');
      }
      fs.writeSync(tty, `\x1b[${extra}A`);
    }
    blockLines = lines.length;
  }

  function activeLine(task) {
    const now = Date.now();
    const elapsed = (now - (task.startedAt || started)) / 1000;
    const counter = `[${task.index}/${task.total}]`.padEnd(9);
    const name = shortName(task.image).padEnd(18).slice(0, 18);

    if (task.retryAt > now) {
      const wait = Math.ceil((task.retryAt - now) / 1000);
      return `${counter} ${name}  retrying in ${wait}s  ${formatDuration(
        elapsed
      )}`;
    }

    const summary = summarize(task.state);
    if (task.lastTotal !== summary.total) {
      task.lastTotal = summary.total;
      task.totalSince = now;
    }
    const stable = summary.total > 0 && now - task.totalSince >= 1000;
    if (stable) {
      return statusLine(task.state, 99, elapsed);
    }
    return preparingLine(task.state, elapsed);
  }

  function buildBlock() {
    const elapsed = (Date.now() - started) / 1000;
    const active = tasks.filter((task) => task.active);
    const lines = [overallLine(completed, tasks.length, concurrency, elapsed)];
    for (const task of active.slice(0, MAX_VISIBLE)) {
      lines.push(activeLine(task));
    }
    if (active.length > MAX_VISIBLE) {
      lines.push(`  … ${active.length - MAX_VISIBLE} more`);
    }
    return lines;
  }

  function allFinished() {
    return tasks.every((task) => task.finished);
  }

  function render(force = false) {
    if (!progressEnabled || done || allFinished()) {
      return;
    }
    const now = Date.now();
    if (!force && now - lastDraw < 500) {
      return;
    }
    lastDraw = now;

    if (tty) {
      drawBlock(buildBlock());
      return;
    }

    if (force || now - lastPlain >= 15000) {
      lastPlain = now;
      process.stdout.write(`${buildBlock().join('\n')}\n`);
    }
  }

  function persist(text) {
    if (tty) {
      clearBlock();
    }
    process.stdout.write(`${text}\n`);
    if (tty) {
      const redraw = () => {
        if (!done && !allFinished()) {
          drawBlock(buildBlock());
        }
      };
      if (process.stdout.isTTY) {
        redraw();
      } else {
        // Let a parent that prints our stdout show the line before the
        // dashboard is redrawn underneath it.
        setTimeout(redraw, 150);
      }
    }
  }

  const abortController = new AbortController();
  const ticker = setInterval(() => render(), 1000);
  if (typeof ticker.unref === 'function') {
    ticker.unref();
  }

  const pullOnce = createPullOnce({
    socketPath,
    onProgress: () => render(),
  });

  const result = await runPool(tasks, {
    concurrency,
    retries,
    retryDelay,
    pullOnce,
    abortController,
    onStart(task) {
      task.startedAt = Date.now();
      render(true);
    },
    onRetry(task, { delay }) {
      task.retryAt = Date.now() + delay * 1000;
      render(true);
    },
    onResult(task, outcome) {
      task.retryAt = 0;
      task.finished = true;
      if (outcome.ok) {
        completed += 1;
        const suffix = outcome.upToDate
          ? 'up to date'
          : `${outcome.seconds.toFixed(1)}s`;
        persist(`  ✓ ${shortName(task.image)} (${suffix})`);
      } else if (!outcome.aborted) {
        persist(`  ✗ ${shortName(task.image)}: ${outcome.message}`);
      }
    },
    onUpdate(force) {
      render(force);
    },
  });

  done = true;
  clearInterval(ticker);
  clearBlock();

  const elapsed = (Date.now() - started) / 1000;
  if (result.ok) {
    process.stdout.write(
      `${progressBar(100, 16)} 100%  pulled ${
        tasks.length
      } images in ${formatDuration(elapsed)}\n`
    );
    process.exitCode = 0;
  } else {
    process.stdout.write(`Pull failed after ${formatDuration(elapsed)}\n`);
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    process.stderr.write(`pull-images: ${error?.message || error}\n`);
    process.exit(1);
  });
}
