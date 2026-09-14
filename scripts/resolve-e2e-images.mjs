#!/usr/bin/env node
/**
 * Works out, for each service an e2e target needs, which image reference to
 * pull and what to fall back to.
 *
 * CI builds every affected app in the `image_check` stage, but on a pull
 * request that stage covers only the apps the diff touched. So a run's own SHA
 * tag exists for some services and not others, and the e2e stack cannot simply
 * ask for one tag across the board.
 *
 * This prints a plan the workflow acts on: pull the SHA tag where it exists,
 * otherwise pull the fallback tag and retag it locally to the SHA, so the
 * compose file's single `${E2E_IMAGE_TAG}` resolves for every service.
 *
 * Usage:
 *   node scripts/resolve-e2e-images.mjs \
 *     --services <file with one service name per line> \
 *     --images <file of "service image" lines from `docker compose config`> \
 *     --sha-tag sha-1234567 --fallback-tag main
 */
import fs from 'node:fs';

/** Services the workflow builds locally, so they never come from a registry. */
export const LOCALLY_BUILT = new Set([
  'db',
  'redis',
  'db-setup',
  'oauth-provider',
]);

/**
 * Splits an image reference into its repository and tag.
 *
 * Only the final path segment can carry a tag, so a colon earlier in the
 * reference — a registry port, say — belongs to the repository.
 */
export function splitImageRef(ref) {
  const lastSlash = ref.lastIndexOf('/');
  const lastColon = ref.lastIndexOf(':');
  if (lastColon > lastSlash) {
    return {
      repository: ref.slice(0, lastColon),
      tag: ref.slice(lastColon + 1),
    };
  }
  return { repository: ref, tag: 'latest' };
}

/**
 * Builds the per-repository image plan for one e2e target.
 *
 * @param {object} input
 * @param {string[]} input.services service names the target needs
 * @param {Map<string,string>} input.images service name -> resolved image ref
 * @param {string} input.shaTag this run's image tag
 * @param {string} input.fallbackTag the tag to fall back to
 */
export function resolveE2eImages({ services, images, shaTag, fallbackTag }) {
  const plan = [];
  const seen = new Set();

  for (const service of services) {
    if (LOCALLY_BUILT.has(service)) continue;

    const ref = images.get(service);
    // A service with no image is built by the compose file itself.
    if (!ref) continue;

    const { repository } = splitImageRef(ref);

    // One entry per repository: several services share an image — permissions
    // and permissions-seed, for instance — and pulling it twice is wasted work.
    if (seen.has(repository)) continue;
    seen.add(repository);

    plan.push({
      service,
      repository,
      shaRef: `${repository}:${shaTag}`,
      fallbackRef: `${repository}:${fallbackTag}`,
    });
  }

  return plan;
}

function readLines(path) {
  return fs
    .readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function main() {
  const args = new Map();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    args.set(argv[i].replace(/^--/, ''), argv[i + 1]);
  }

  const services = readLines(args.get('services'));
  const images = new Map(
    readLines(args.get('images')).map((line) => {
      const spaceAt = line.indexOf(' ');
      return [line.slice(0, spaceAt), line.slice(spaceAt + 1)];
    })
  );

  const plan = resolveE2eImages({
    services,
    images,
    shaTag: args.get('sha-tag'),
    fallbackTag: args.get('fallback-tag'),
  });

  for (const entry of plan) {
    process.stdout.write(`${entry.shaRef}\t${entry.fallbackRef}\n`);
  }
}

if (process.argv[1] && process.argv[1].endsWith('resolve-e2e-images.mjs')) {
  main();
}
