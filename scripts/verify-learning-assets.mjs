import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_BODY_BYTES = 16 * 1024 * 1024;
export const DEFAULT_MAX_INDEX_BYTES = 1 * 1024 * 1024;

const baseUrl = process.argv[2] || process.env['LEARNING_REVIEW_URL'];

if (isMainModule()) {
  if (!baseUrl) {
    console.error(
      'Usage: node scripts/verify-learning-assets.mjs <review-server-url>'
    );
    process.exitCode = 1;
  } else {
    try {
      const result = await verifyLearningAssets(baseUrl, {
        requireHashedAssets:
          process.env['LEARNING_REQUIRE_HASHED_ASSETS'] !== 'false',
      });
      console.log(
        `learning assets ready: ${result.checked} referenced assets verified`
      );
    } catch (error) {
      console.error(
        `learning assets readiness failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      process.exitCode = 1;
    }
  }
}

export async function verifyLearningAssets(
  baseUrl,
  {
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
    maxIndexBytes = DEFAULT_MAX_INDEX_BYTES,
    requireHashedAssets = true,
  } = {}
) {
  const rootUrl = new URL('/', baseUrl);
  const indexResponse = await fetchWithTimeout(rootUrl, requestTimeoutMs);
  const indexContentType = indexResponse.headers.get('content-type') || '';
  const indexHtml = await readResponseBody(
    indexResponse,
    maxIndexBytes,
    `index ${rootUrl}`
  );

  assert.equal(
    indexResponse.status,
    200,
    `index returned HTTP ${indexResponse.status}`
  );
  assert.match(
    indexContentType,
    /text\/html/i,
    `index returned ${indexContentType || 'no content type'}`
  );

  const references = collectAssetReferences(indexHtml);
  assert.ok(
    references.length > 0,
    'index did not reference any browser assets'
  );

  for (const reference of references) {
    const assetUrl = new URL(reference.path, rootUrl);
    assert.equal(
      assetUrl.origin,
      rootUrl.origin,
      `asset points outside the review server: ${reference.path}`
    );

    if (requireHashedAssets) {
      assert.ok(
        isHashedBrowserAsset(assetUrl.pathname),
        `${reference.kind} ${reference.path} is not a production-hashed asset`
      );
    }

    const response = await fetchWithTimeout(assetUrl, requestTimeoutMs);
    const contentType = response.headers.get('content-type') || '';
    const body = await readResponseBody(
      response,
      maxBodyBytes,
      `${reference.kind} ${reference.path}`
    );

    assert.equal(
      response.status,
      200,
      `${reference.kind} ${reference.path} returned HTTP ${response.status}`
    );
    assert.match(
      contentType,
      reference.kind === 'style' ? /text\/css/i : /javascript/i,
      `${reference.kind} ${reference.path} returned ${
        contentType || 'no content type'
      }`
    );
    assert.doesNotMatch(
      body.slice(0, 256),
      /^\s*</,
      `${reference.kind} ${reference.path} returned markup instead of an asset`
    );
  }

  return { checked: references.length };
}

export function isHashedBrowserAsset(path) {
  const filename = path.split('/').pop() || '';
  return /(?:^|[-_.])[A-Za-z0-9]{8,}\.(?:css|js|mjs)$/i.test(filename);
}

async function fetchWithTimeout(url, timeoutMs) {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { signal });
}

async function readResponseBody(response, maxBytes, label) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `${label} response body exceeds the ${maxBytes}-byte readiness limit`
    );
  }

  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let body = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        return body + decoder.decode();
      }

      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(
          `${label} response body exceeds the ${maxBytes}-byte readiness limit`
        );
      }
      body += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function collectAssetReferences(indexHtml) {
  const references = [];
  const tagPattern = /<(script|link)\b[^>]*>/gi;

  for (const match of indexHtml.matchAll(tagPattern)) {
    const tagName = match[1].toLowerCase();
    const tag = match[0];
    const path = tag.match(/\b(?:src|href)=["']([^"']+)["']/i)?.[1];
    if (!path || path.startsWith('data:')) {
      continue;
    }

    if (tagName === 'script') {
      references.push({ kind: 'script', path });
      continue;
    }

    if (/\brel=["'][^"']*\bmodulepreload\b[^"']*["']/i.test(tag)) {
      references.push({ kind: 'modulepreload', path });
      continue;
    }

    if (/\brel=["'][^"']*\bstylesheet\b[^"']*["']/i.test(tag)) {
      references.push({ kind: 'style', path });
    }
  }

  return references;
}

function isMainModule() {
  return (
    process.argv[1] &&
    pathToFileURL(resolve(process.argv[1])).href ===
      pathToFileURL(fileURLToPath(import.meta.url)).href
  );
}
