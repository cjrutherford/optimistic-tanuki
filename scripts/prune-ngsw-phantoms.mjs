#!/usr/bin/env node
/**
 * Removes entries from ngsw.json that name a file the browser bundle does not
 * contain.
 *
 * WHY THIS EXISTS
 *
 * The learning app is server-rendered, so `nx build` writes two bundles under
 * one output path: `browser/` (what a visitor downloads) and `server/` (what
 * Node runs). The service worker manifest is generated from `ngsw-config.json`,
 * whose asset group globs `/*.css` and `/*.js`. At least one CSS file emitted
 * for the server build was picked up by that glob and written into `ngsw.json`,
 * which ships in `browser/`.
 *
 * The consequence is worse than a missing file. `server.ts` serves static
 * assets only out of `browser/`, so a request for that CSS falls through to the
 * single-page fallback and comes back as `index.csr.html`: status 200, wrong
 * bytes. The service worker prefetches every asset in its manifest and checks
 * each one against a hash, so it sees a hash mismatch, the version never
 * becomes usable, and every request queued behind initialisation waits forever.
 *
 * What that looked like from outside: the front door worked on a hard refresh,
 * and then every client-side navigation hung. The catalog sat on "Loading
 * catalog", "Mark as read" sat on "Saving...", and nothing errored, because
 * nothing had failed. The requests were simply never answered. It was found by
 * walking the site signed out in a real browser, not by any test, and the whole
 * suite was green throughout.
 *
 * Pruning rather than failing the build is deliberate. The stray file comes out
 * of the framework's own output, so failing would block every release on
 * something this repository does not control, and the correct end state (a
 * manifest describing only files that are actually served) is exactly what
 * pruning produces. Anything removed is printed, so this going from quiet to
 * noisy is a signal worth reading rather than something to scroll past.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const browserDir = resolve(process.argv[2] ?? 'dist/apps/learning/browser');
const manifestPath = join(browserDir, 'ngsw.json');

if (!existsSync(browserDir)) {
  // A wrong path must not look like a clean run. Without this, a typo in the
  // build step would report success while doing nothing at all.
  console.error(
    `prune-ngsw-phantoms: no such directory ${browserDir}. Check the path passed by the build.`
  );
  process.exit(1);
}

if (!existsSync(manifestPath)) {
  // A development build has no service worker, and that is not an error.
  console.log(
    `prune-ngsw-phantoms: no manifest at ${manifestPath}, nothing to do.`
  );
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const phantoms = Object.keys(manifest.hashTable ?? {}).filter(
  (url) => !existsSync(join(browserDir, url))
);

if (phantoms.length === 0) {
  console.log(
    'prune-ngsw-phantoms: every manifest entry exists. Nothing pruned.'
  );
  process.exit(0);
}

for (const url of phantoms) delete manifest.hashTable[url];
for (const group of manifest.assetGroups ?? []) {
  group.urls = (group.urls ?? []).filter((url) => !phantoms.includes(url));
}

writeFileSync(manifestPath, JSON.stringify(manifest));

console.log(
  `prune-ngsw-phantoms: removed ${phantoms.length} entry/entries naming files absent from ${browserDir}:`
);
for (const url of phantoms) console.log(`  ${url}`);
console.log(
  'Left in place, each of these would have hung every request the service worker handled.'
);
