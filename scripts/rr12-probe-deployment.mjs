#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANIFEST_NAME, MANIFEST_SCHEMA } from './rr12-deployment-manifest.mjs';

const MAX_HTML_BYTES = 12 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 12 * 1024 * 1024;
const MAX_ASSET_BYTES = 128 * 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 512 * 1024 * 1024;
const MAX_ASSET_COUNT = 3000;
const SAFE_CLAIM =
  /\b(?:private by default|yours alone|real[- ]time connection|live notifications|never miss what matters|yours forever|don't disappear|do not disappear|safe\s*&\s*moderated|moderation,? reputation|funding goal|fund your community|recurring donations?|featured placement|analytics|pro tier|basic free)\b/gi;

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith('--') || !argv[index + 1]) {
      throw new Error(`Expected --name value near ${key}`);
    }
    values.set(key.slice(2), argv[++index]);
  }
  return values;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function boundedAssetPath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 1024 ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#')
  ) {
    throw new Error('unsafe asset path');
  }
  const segments = value.split('/');
  if (
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('unsafe asset path');
  }
  return segments.join('/');
}

export function validateServedManifest(value, expectedApp) {
  if (
    !value ||
    value.schema !== MANIFEST_SCHEMA ||
    value.app !== expectedApp ||
    (value.sourceRevision !== null &&
      !/^[a-f0-9]{40}$/i.test(value.sourceRevision)) ||
    !Array.isArray(value.files) ||
    value.files.length === 0 ||
    value.files.length > MAX_ASSET_COUNT
  ) {
    throw new Error('manifest contract mismatch');
  }
  const validRunId =
    value.workflowRunId === null ||
    (typeof value.workflowRunId === 'string' &&
      /^[0-9]{1,20}$/.test(value.workflowRunId));
  const validRunAttempt =
    value.workflowRunAttempt === null ||
    (typeof value.workflowRunAttempt === 'string' &&
      /^[0-9]{1,20}$/.test(value.workflowRunAttempt));
  if (
    !validRunId ||
    !validRunAttempt ||
    (value.workflowRunId === null) !== (value.workflowRunAttempt === null)
  ) {
    throw new Error('manifest workflow run metadata invalid');
  }
  const paths = new Set();
  for (const file of value.files) {
    const safePath = boundedAssetPath(file?.path);
    if (
      safePath === MANIFEST_NAME ||
      paths.has(safePath) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[a-f0-9]{64}$/i.test(file.sha256)
    ) {
      throw new Error('manifest file entry invalid');
    }
    paths.add(safePath);
  }
  return value;
}

async function readResponse(response, maxBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error('response exceeded the configured size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function safeHeaders(headers) {
  const result = {};
  for (const name of [
    'content-type',
    'etag',
    'last-modified',
    'cache-control',
  ]) {
    const value = headers.get(name);
    if (value) result[name] = value.slice(0, 500);
  }
  return result;
}

function htmlText(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function claimContexts(html) {
  const visible = htmlText(html);
  const claims = [];
  for (const match of visible.matchAll(SAFE_CLAIM)) {
    const start = Math.max(0, match.index - 110);
    const end = Math.min(visible.length, match.index + match[0].length + 110);
    const context = visible.slice(start, end).trim();
    if (!claims.some((entry) => entry.context === context)) {
      claims.push({ matched_text: match[0], context });
    }
  }
  return claims;
}

function parseAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(
    /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
  )) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

export function criticalAssetPaths(html, origin) {
  const paths = new Set();
  const external = new Map();
  const unchecked = new Map();
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const attributes = parseAttributes(tag);
    const isScript = tag.slice(1, 7).toLowerCase() === 'script';
    const rel = (attributes.rel ?? '').toLowerCase().split(/\s+/);
    const isCriticalLink =
      rel.includes('stylesheet') ||
      rel.includes('modulepreload') ||
      (rel.includes('preload') &&
        ['script', 'style'].includes((attributes.as ?? '').toLowerCase()));
    const reference = isScript
      ? attributes.src
      : isCriticalLink
      ? attributes.href
      : null;
    if (!reference) {
      if (isCriticalLink) {
        unchecked.set(`${rel.join(' ')}:missing-reference`, {
          relation: rel.join(' '),
          reason: 'missing-reference',
          status: 'not-fetched',
        });
      }
      continue;
    }
    let resolved;
    try {
      resolved = new URL(reference, origin);
    } catch {
      unchecked.set(
        `${isScript ? 'script' : rel.join(' ')}:invalid-reference`,
        {
          relation: isScript ? 'script' : rel.join(' '),
          reason: 'invalid-reference',
          status: 'not-fetched',
        }
      );
      continue;
    }
    if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') {
      unchecked.set(`${resolved.protocol}:${resolved.pathname}`, {
        origin: resolved.protocol,
        path: resolved.pathname.slice(0, 1024),
        relation: isScript ? 'script' : rel.join(' '),
        reason: 'unsupported-scheme',
        status: 'not-fetched',
      });
      continue;
    }
    if (resolved.origin !== origin) {
      external.set(`${resolved.origin}${resolved.pathname}`, {
        origin: resolved.origin,
        path: resolved.pathname,
        relation: isScript ? 'script' : rel.join(' '),
        reason:
          resolved.search || resolved.hash
            ? 'query-or-fragment-not-fetched'
            : 'external-origin-not-fetched',
        status: 'not-fetched',
      });
      continue;
    }
    if (resolved.search || resolved.hash) {
      unchecked.set(`${resolved.origin}${resolved.pathname}`, {
        origin: resolved.origin,
        path: resolved.pathname,
        relation: isScript ? 'script' : rel.join(' '),
        reason: 'query-or-fragment-not-fetched',
        status: 'not-fetched',
      });
      continue;
    }
    try {
      const pathname = decodeURIComponent(resolved.pathname.replace(/^\//, ''));
      if (pathname) paths.add(boundedAssetPath(pathname));
    } catch {
      unchecked.set(`${resolved.origin}${resolved.pathname}`, {
        origin: resolved.origin,
        path: resolved.pathname.slice(0, 1024),
        relation: isScript ? 'script' : rel.join(' '),
        reason: 'unsafe-path-not-fetched',
        status: 'not-fetched',
      });
    }
  }
  return {
    sameOriginPaths: [...paths].sort(),
    externalCriticalResources: [...external.values()].sort((left, right) =>
      `${left.origin}${left.path}`.localeCompare(`${right.origin}${right.path}`)
    ),
    uncheckedCriticalResources: [...unchecked.values()].sort((left, right) =>
      `${left.origin ?? ''}${left.path ?? ''}${left.reason}`.localeCompare(
        `${right.origin ?? ''}${right.path ?? ''}${right.reason}`
      )
    ),
  };
}

function validateOrigin(originValue) {
  const origin = new URL(originValue);
  const localHttp =
    origin.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (
    (!localHttp && origin.protocol !== 'https:') ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    !['', '/'].includes(origin.pathname)
  ) {
    throw new Error(
      'site URL must be an HTTPS origin without path, query, or credentials (loopback HTTP is allowed for local checks)'
    );
  }
  return origin.origin;
}

async function fetchBytes(url, maxBytes) {
  const response = await fetch(url, {
    redirect: 'manual',
    credentials: 'omit',
    headers: { accept: '*/*' },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status >= 300 && response.status < 400) {
    return {
      status: response.status,
      headers: safeHeaders(response.headers),
      bytes: null,
      error: 'redirect not followed',
    };
  }
  const bytes = await readResponse(response, maxBytes);
  return {
    status: response.status,
    headers: safeHeaders(response.headers),
    bytes,
  };
}

function urlForAsset(origin, relativePath) {
  const pathname = relativePath.split('/').map(encodeURIComponent).join('/');
  return new URL(`/${pathname}`, origin);
}

export async function inspectSite({
  product,
  siteUrl,
  expectedRevision = null,
}) {
  if (!['OT', 'TS'].includes(product))
    throw new Error('product must be OT or TS');
  if (expectedRevision !== null && !/^[a-f0-9]{40}$/i.test(expectedRevision)) {
    throw new Error('expectedRevision must be a full 40-character Git SHA');
  }
  const origin = validateOrigin(siteUrl);
  const result = {
    product,
    origin,
    capturedAtUtc: new Date().toISOString(),
    status: 'unavailable',
    root: null,
    visibleClaimContexts: [],
    manifest: null,
    externalCriticalResources: [],
    uncheckedCriticalResources: [],
    expectedReviewedRevision: expectedRevision?.toLowerCase() ?? null,
    checkedAssetCount: 0,
    checkedAssetBytes: 0,
    mismatches: [],
    error: null,
  };

  try {
    const rootResponse = await fetchBytes(new URL('/', origin), MAX_HTML_BYTES);
    result.root = {
      status: rootResponse.status,
      headers: rootResponse.headers,
      bytes: rootResponse.bytes?.length ?? null,
      sha256: rootResponse.bytes ? sha256(rootResponse.bytes) : null,
    };
    if (rootResponse.status !== 200 || !rootResponse.bytes) {
      result.error = rootResponse.error ?? 'root response was not HTTP 200';
      return result;
    }
    const html = rootResponse.bytes.toString('utf8');
    result.visibleClaimContexts = claimContexts(html);
    const manifestResponse = await fetchBytes(
      new URL(`/${MANIFEST_NAME}`, origin),
      MAX_MANIFEST_BYTES
    );
    if (manifestResponse.status !== 200 || !manifestResponse.bytes) {
      result.error =
        manifestResponse.error ??
        `manifest request returned HTTP ${manifestResponse.status}`;
      return result;
    }
    let manifest;
    try {
      manifest = validateServedManifest(
        JSON.parse(manifestResponse.bytes.toString('utf8')),
        product === 'OT' ? 'client-interface' : 'local-hub'
      );
    } catch (error) {
      result.status = 'failed';
      result.error = `manifest invalid: ${error.message}`;
      return result;
    }
    result.manifest = {
      status: 'valid',
      schema: manifest.schema,
      app: manifest.app,
      sourceRevision: manifest.sourceRevision,
      workflowRunId: manifest.workflowRunId,
      workflowRunAttempt: manifest.workflowRunAttempt,
      listedFileCount: manifest.files.length,
      sha256: sha256(manifestResponse.bytes),
    };

    const expected = new Map(manifest.files.map((file) => [file.path, file]));
    const criticalReferences = criticalAssetPaths(html, origin);
    result.externalCriticalResources =
      criticalReferences.externalCriticalResources;
    result.uncheckedCriticalResources =
      criticalReferences.uncheckedCriticalResources;
    const paths = new Set([
      ...expected.keys(),
      ...criticalReferences.sameOriginPaths,
    ]);
    if (paths.size > MAX_ASSET_COUNT) {
      result.status = 'failed';
      result.error = 'asset inventory exceeds the configured count limit';
      return result;
    }
    for (const assetPath of [...paths].sort()) {
      const assetUrl = urlForAsset(origin, assetPath);
      if (assetUrl.origin !== origin) {
        result.mismatches.push({
          path: assetPath,
          reason: 'origin escaped site boundary',
        });
        continue;
      }
      let response;
      try {
        response = await fetchBytes(assetUrl, MAX_ASSET_BYTES);
      } catch (error) {
        result.mismatches.push({
          path: assetPath,
          reason: `fetch failed: ${error.message}`,
        });
        continue;
      }
      result.checkedAssetCount += 1;
      if (response.status !== 200 || !response.bytes) {
        result.mismatches.push({
          path: assetPath,
          reason: `HTTP ${response.status}`,
        });
        continue;
      }
      result.checkedAssetBytes += response.bytes.length;
      if (result.checkedAssetBytes > MAX_TOTAL_ASSET_BYTES) {
        result.status = 'failed';
        result.error =
          'asset inventory exceeds the configured total-byte limit';
        return result;
      }
      const expectedFile = expected.get(assetPath);
      if (!expectedFile) {
        result.mismatches.push({
          path: assetPath,
          reason: 'critical HTML asset missing from build manifest',
        });
        continue;
      }
      if (
        response.bytes.length !== expectedFile.bytes ||
        sha256(response.bytes) !== expectedFile.sha256
      ) {
        result.mismatches.push({
          path: assetPath,
          reason: 'served bytes differ from build manifest',
        });
      }
    }
    if (
      expectedRevision &&
      manifest.sourceRevision !== expectedRevision.toLowerCase()
    ) {
      result.mismatches.push({
        path: MANIFEST_NAME,
        reason:
          'manifest source revision differs from expected reviewed revision',
      });
    }
    const hasUncheckedCriticalResources =
      result.externalCriticalResources.length > 0 ||
      result.uncheckedCriticalResources.length > 0;
    result.status =
      result.mismatches.length > 0
        ? 'failed'
        : !expectedRevision
        ? 'assets-match-only'
        : !manifest.sourceRevision
        ? 'failed'
        : hasUncheckedCriticalResources
        ? 'verified-same-origin-assets-with-unchecked-critical-resources'
        : 'verified';
    if (!manifest.sourceRevision && !result.error) {
      result.error = 'build manifest does not identify a Git revision';
    }
  } catch (error) {
    result.error = error.message;
  }
  return result;
}

async function writePrivateReceipt(outputDir, receipt) {
  const absoluteDir = path.resolve(outputDir);
  await fs.mkdir(absoluteDir, { recursive: true, mode: 0o700 });
  await fs.chmod(absoluteDir, 0o700);
  const filename = `production-bundle-check-${receipt.capturedAtUtc.replace(
    /[:.]/g,
    '-'
  )}.json`;
  const output = path.join(absoluteDir, filename);
  await fs.writeFile(output, `${JSON.stringify(receipt, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  await fs.chmod(output, 0o600);
  return output;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const expectedRevision = args.get('expected-revision') ?? null;
  const sites = args
    .get('site')
    ?.split(',')
    .map((item) => {
      const separator = item.indexOf('=');
      if (separator < 1)
        throw new Error('--site format is PRODUCT=HTTPS_ORIGIN');
      return {
        product: item.slice(0, separator),
        siteUrl: item.slice(separator + 1),
      };
    });
  if (!sites?.length || !args.get('output-dir')) {
    throw new Error(
      'Usage: node scripts/rr12-probe-deployment.mjs --site OT=https://host,TS=https://host --expected-revision <full-sha> --output-dir .runtime-artifacts/rr12'
    );
  }
  const sitesResults = [];
  for (const site of sites)
    sitesResults.push(await inspectSite({ ...site, expectedRevision }));
  const receipt = {
    schema: 'optimistic-tanuki.rr12-public-deployment-check.v1',
    capturedAtUtc: new Date().toISOString(),
    scope:
      'Unauthenticated public GET; records SSR HTML fingerprint, compares every listed local browser file and same-origin critical HTML resource against an embedded build manifest, and lists external or otherwise unchecked critical resources without fetching them. Use --expected-revision to verify the manifest names the reviewed source revision.',
    identityLimit:
      'The public manifest is self-reported by the served app. Even an expected-revision match does not prove the running image or Argo revision; retain operator image-digest and Argo evidence separately.',
    browserVisibilityLimit:
      'Copy matches are extracted from server-rendered HTML text only. This does not claim browser-visible state or authenticated content. Manifested files cover the static browser directory, including lazy chunks; dynamic SSR/server code and listed external or otherwise unchecked critical resources are not byte-verified by this probe.',
    sites: sitesResults,
  };
  const output = await writePrivateReceipt(args.get('output-dir'), receipt);
  for (const site of sitesResults) {
    process.stdout.write(
      `${site.product}: ${site.status}; assets=${
        site.checkedAssetCount
      }; unchecked-critical=${
        site.externalCriticalResources.length +
        site.uncheckedCriticalResources.length
      }; mismatches=${site.mismatches.length}\n`
    );
  }
  process.stdout.write(`Private receipt: ${output}\n`);
  if (sitesResults.some((site) => site.status !== 'verified'))
    process.exitCode = 2;
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
