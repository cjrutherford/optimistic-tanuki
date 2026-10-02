import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Replay parity gate for the Daylight port (plan slice P0.1, gate P2.4).
 *
 * The Daylight proof of concept recorded source corpora and the sha256 of
 * every briefing and story it published from them (`golden/baseline.json`).
 * This tool replays those corpora through civic-briefing's replay entry and
 * compares hashes. A difference is a bug or a decision, and has to be
 * explained in the plan before it is accepted.
 *
 * The POC is closed and its data stays out of this repository: it is read in
 * place, read-only, from DAYLIGHT_POC_DIR. Output goes to tmp/civic-parity.
 *
 *   DAYLIGHT_POC_DIR=~/workspace/daylight-poc \
 *   CIVIC_PARITY_DATABASE_URL=postgres://…/parity_{corpus} \
 *   pnpm civic:parity [--require]
 *
 * Without the POC checkout or the civic-briefing build there is nothing to
 * compare, so the tool reports SKIPPED and exits 0; `--require` makes that a
 * failure, for use as the gate.
 */

export const DEFAULT_REPLAY = 'dist/apps/civic-briefing/replay.js';
export const DEFAULT_WORK = 'tmp/civic-parity';
/** Matches the POC's golden harness, which recorded the baseline. */
export const BACKFILL_DAYS = '120';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Adapters stamp the wall clock as fetch time, so full timestamps are
 * normalised before hashing. Plain dates are content and are left alone.
 * Must stay identical to the POC's normalize(), or every hash differs.
 */
export function normalize(markdown) {
  return markdown.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/gu,
    '<timestamp>'
  );
}

/** Hashes every markdown artifact under briefings/ and stories/. */
export function artifactsUnder(root) {
  const hashes = {};
  const walk = (directory) => {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(path);
        continue;
      }
      if (!entry.name.endsWith('.md')) continue;
      // POSIX separators, so keys match the baseline on every platform.
      hashes[relative(root, path).split(sep).join('/')] = sha256(
        normalize(readFileSync(path, 'utf8'))
      );
    }
  };
  walk(join(root, 'briefings'));
  walk(join(root, 'stories'));
  return hashes;
}

export function compare(baseline, current) {
  const differences = [];
  const corpora = new Set([
    ...Object.keys(baseline.artifacts),
    ...Object.keys(current.artifacts),
  ]);
  for (const corpus of corpora) {
    const before = baseline.artifacts[corpus] ?? {};
    const after = current.artifacts[corpus] ?? {};
    for (const artifact of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      if (!(artifact in before))
        differences.push({ corpus, artifact, kind: 'added' });
      else if (!(artifact in after))
        differences.push({ corpus, artifact, kind: 'removed' });
      else if (before[artifact] !== after[artifact])
        differences.push({ corpus, artifact, kind: 'changed' });
    }
  }
  return differences.sort(
    (a, b) =>
      a.corpus.localeCompare(b.corpus) || a.artifact.localeCompare(b.artifact)
  );
}

/**
 * Resolves inputs from the environment. `skip` names what is missing; the
 * paths are absolute so the replay can run from any working directory.
 */
export function resolveSettings(env, cwd) {
  const replay = resolve(cwd, env.CIVIC_PARITY_REPLAY || DEFAULT_REPLAY);
  const work = resolve(cwd, env.CIVIC_PARITY_WORK || DEFAULT_WORK);
  const databaseTemplate = env.CIVIC_PARITY_DATABASE_URL || '';
  if (!env.DAYLIGHT_POC_DIR) {
    return { skip: 'DAYLIGHT_POC_DIR is not set' };
  }
  const poc = resolve(cwd, env.DAYLIGHT_POC_DIR);
  if (work === poc || work.startsWith(poc + sep)) {
    throw new Error(
      `work directory ${work} is inside the POC checkout, which is read-only`
    );
  }
  const baselinePath = join(poc, 'golden', 'baseline.json');
  if (!existsSync(baselinePath)) {
    return { skip: `no baseline at ${baselinePath}` };
  }
  if (!existsSync(replay)) {
    return {
      skip: `civic-briefing replay is not built yet (${replay})`,
    };
  }
  if (!databaseTemplate.includes('{corpus}')) {
    return {
      skip: 'CIVIC_PARITY_DATABASE_URL is not set to a postgres URL containing {corpus}',
    };
  }
  return { poc, baselinePath, replay, work, databaseTemplate };
}

/**
 * `{corpus}` in CIVIC_PARITY_DATABASE_URL gives each corpus its own Postgres
 * database. Each must be empty before a run: the replay creates the schema in
 * an empty database and would otherwise add to an earlier run's rows.
 */
export function databaseUrl(template, corpus) {
  return template.replaceAll('{corpus}', corpus);
}

export function replayArguments(settings, run, out) {
  return [
    settings.replay,
    '--corpus',
    join(settings.poc, 'data', 'corpus', run.corpus),
    '--towns',
    ...run.towns,
    '--from',
    run.from,
    '--to',
    run.to,
    '--backfill-days',
    BACKFILL_DAYS,
    '--database',
    databaseUrl(settings.databaseTemplate, run.corpus),
    '--artifacts',
    out,
    '--localities',
    join(settings.poc, 'localities'),
  ];
}

/** Replays every run the baseline recorded and hashes what it published. */
export function collect(settings, baseline, log = () => undefined) {
  const artifacts = {};
  for (const run of baseline.runs) {
    const out = join(settings.work, run.corpus, 'out');
    rmSync(join(settings.work, run.corpus), { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    log(
      `replaying ${run.corpus} (${run.towns.join(', ')}) ${run.from}..${run.to}`
    );
    // Replays cache downloads, OCR text and a publication lock under ./data;
    // keep those in the corpus's work directory, never the repository.
    execFileSync(process.execPath, replayArguments(settings, run, out), {
      cwd: join(settings.work, run.corpus),
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    artifacts[run.corpus] = artifactsUnder(out);
    log(`  ${Object.keys(artifacts[run.corpus]).length} artifacts`);
  }
  return { artifacts };
}

/** Returns the exit code. */
export function verify({ env, cwd, argv, out, err }) {
  const settings = resolveSettings(env, cwd);
  if (settings.skip) {
    const required = argv.includes('--require');
    (required ? err : out)(`SKIPPED: ${settings.skip}`);
    return required ? 1 : 0;
  }
  const baseline = JSON.parse(readFileSync(settings.baselinePath, 'utf8'));
  const current = collect(settings, baseline, err);
  const differences = compare(baseline, current);
  const total = Object.values(current.artifacts).reduce(
    (sum, corpus) => sum + Object.keys(corpus).length,
    0
  );
  if (!differences.length) {
    out(`identical to the baseline: ${total} artifacts`);
    return 0;
  }
  err(`${differences.length} artifact(s) differ from the baseline:`);
  for (const difference of differences) {
    err(`- ${difference.corpus}/${difference.artifact}: ${difference.kind}`);
  }
  err(
    '\nEach difference is a bug or a decision. Explain it in the plan before accepting it.'
  );
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = verify({
    env: process.env,
    cwd: process.cwd(),
    argv: process.argv.slice(2),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
