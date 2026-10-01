import { createHash } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { OutboundPolicyError } from './outbound-policy.js';
import { registrableHost } from './restricted-publishers.js';
import type {
  HttpClient,
  HttpRequestInit,
  HttpResponse,
  Summarizer,
} from './types.js';

/**
 * A recorded source corpus: every HTTP response the pipeline received while
 * recording, stored per deployment (never in git). Replaying it gives
 * repeatable development runs that do not depend on live municipal sites.
 *
 * Layout: `index.jsonl` (one entry per response), `bodies/<sha256>` (body
 * bytes, stored once), `manifest.json` (recording sessions).
 */
export interface CorpusEntry {
  url: string;
  recordedAt: string;
  status?: number;
  headers?: [string, string][];
  finalUrl?: string;
  redirectChain?: string[];
  /** SHA-256 of the body file. */
  body?: string;
  bytes?: number;
  /** Transport or policy failure observed while recording. */
  error?: { message: string; code?: 'restricted-domain'; url?: string };
}

export interface CorpusManifest {
  version: 1;
  recordings: { recordedAt: string; localities: string[] }[];
}

/** An HTTP client that can also check a URL without fetching it (the outbound policy does). */
export type ValidatingHttpClient = HttpClient & {
  validate?(value: string, baseUrl?: string): Promise<URL>;
};

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function toResponse(entry: CorpusEntry, body: Uint8Array | null): HttpResponse {
  const status = entry.status ?? 200;
  const nullBody = status === 204 || status === 205 || status === 304;
  const response = new Response(
    nullBody || !body ? null : (body.slice().buffer as ArrayBuffer),
    { status, headers: entry.headers ?? [] }
  );
  return Object.assign(response, {
    finalUrl: entry.finalUrl ?? entry.url,
    redirectChain: entry.redirectChain ?? [entry.url],
  }) as HttpResponse;
}

export function readCorpusManifest(directory: string): CorpusManifest {
  const path = join(directory, 'manifest.json');
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, 'utf8')) as CorpusManifest)
    : { version: 1, recordings: [] };
}

export function readCorpusIndex(directory: string): CorpusEntry[] {
  const path = join(directory, 'index.jsonl');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CorpusEntry);
}

/**
 * Wrap a live client so each response is written to the corpus. Within one
 * recording session a URL is fetched once; later requests (a county source
 * shared by several towns) are served from the session copy.
 */
export function createRecordingHttpClient(
  inner: ValidatingHttpClient,
  directory: string,
  recordedAt = new Date().toISOString()
): ValidatingHttpClient & { entries: number } {
  mkdirSync(join(directory, 'bodies'), { recursive: true });
  const session = new Map<
    string,
    { entry: CorpusEntry; body: Uint8Array | null }
  >();
  const client = {
    entries: 0,
    ...(inner.validate
      ? {
          validate: (value: string, baseUrl?: string) =>
            inner.validate!(value, baseUrl),
        }
      : {}),
    async fetch(input: string, init?: HttpRequestInit): Promise<HttpResponse> {
      const cached = session.get(input);
      if (cached) return replayEntry(cached.entry, cached.body, init);
      let entry: CorpusEntry;
      let body: Uint8Array | null = null;
      try {
        const response = await inner.fetch(input, init);
        body = new Uint8Array(await response.arrayBuffer());
        const digest = sha256(body);
        const bodyPath = join(directory, 'bodies', digest);
        if (!existsSync(bodyPath)) writeFileSync(bodyPath, body);
        entry = {
          url: input,
          recordedAt,
          status: response.status,
          headers: [...response.headers.entries()],
          finalUrl: response.finalUrl,
          redirectChain: [...response.redirectChain],
          body: digest,
          bytes: body.byteLength,
        };
      } catch (error) {
        entry = {
          url: input,
          recordedAt,
          error:
            error instanceof OutboundPolicyError
              ? { message: error.message, code: error.code, url: error.url }
              : {
                  message:
                    error instanceof Error ? error.message : String(error),
                },
        };
      }
      appendFileSync(
        join(directory, 'index.jsonl'),
        `${JSON.stringify(entry)}\n`
      );
      session.set(input, { entry, body });
      client.entries += 1;
      return replayEntry(entry, body, init);
    },
  };
  return client;
}

function replayEntry(
  entry: CorpusEntry,
  body: Uint8Array | null,
  init?: HttpRequestInit
): HttpResponse {
  if (entry.error) {
    if (entry.error.code === 'restricted-domain' && entry.error.url)
      throw new OutboundPolicyError(entry.error.url);
    throw new Error(entry.error.message);
  }
  const denied = init?.policy?.deniedRegistrableDomains;
  const finalHost = registrableHost(entry.finalUrl ?? entry.url);
  if (
    denied &&
    finalHost &&
    [...denied].some(
      (domain) => finalHost === domain || finalHost.endsWith(`.${domain}`)
    )
  ) {
    throw new OutboundPolicyError(entry.finalUrl ?? entry.url);
  }
  return toResponse(entry, body);
}

/** Record the localities covered by one recording session. */
export function appendCorpusRecording(
  directory: string,
  recordedAt: string,
  localities: readonly string[]
): void {
  const manifest = readCorpusManifest(directory);
  manifest.recordings.push({ recordedAt, localities: [...localities] });
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
}

/**
 * Serve responses from a corpus without network access. For each URL the
 * latest recording at or before `asOf` is used (when all are later, the
 * newest recording from the first recording day). Unrecorded URLs fail like an unreachable host and are listed in
 * `misses`.
 */
export function createReplayHttpClient(
  directory: string,
  options: { asOf?: () => Date } = {}
): ValidatingHttpClient & { misses: string[] } {
  const byUrl = new Map<string, CorpusEntry[]>();
  for (const entry of readCorpusIndex(directory))
    byUrl.set(entry.url, [...(byUrl.get(entry.url) ?? []), entry]);
  for (const entries of byUrl.values())
    entries.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const misses: string[] = [];
  return {
    misses,
    async validate(value: string): Promise<URL> {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error(
          `outbound URL protocol is not allowed: ${url.protocol}`
        );
      return url;
    },
    async fetch(input: string, init?: HttpRequestInit): Promise<HttpResponse> {
      const entries = byUrl.get(input);
      if (!entries?.length) {
        misses.push(input);
        throw new Error(`not in corpus: ${input}`);
      }
      const asOf = options.asOf?.().toISOString();
      // Before the first recording day, use that day's newest recording (a same-day re-record replaces a failed fetch).
      const firstDay = entries[0]!.recordedAt.slice(0, 10);
      const entry =
        (asOf
          ? entries.filter((candidate) => candidate.recordedAt <= asOf).at(-1)
          : undefined) ??
        (asOf
          ? entries
              .filter((candidate) => candidate.recordedAt.startsWith(firstDay))
              .at(-1)!
          : entries.at(-1)!);
      const body = entry.body
        ? new Uint8Array(readFileSync(join(directory, 'bodies', entry.body)))
        : null;
      return replayEntry(entry, body, init);
    },
  };
}

/**
 * A summarizer that invents nothing.
 *
 * Replays run without a model so their output depends only on recorded
 * inputs, which is what makes two implementations comparable. It lives here,
 * with the replay client, because both the command line and the pipeline
 * service need it.
 */
export const replaySummarizer: Summarizer = {
  model: 'replay-deterministic',
  summarizeCluster: async ({ items }) => ({
    summary: items.map((item) => item.title).join('; '),
    model: 'replay-deterministic',
  }),
  tldr: async ({ clusterSummaries }) => ({
    bullets: clusterSummaries
      .slice(0, 3)
      .map((cluster) => cluster.title ?? cluster.heading),
    model: 'replay-deterministic',
  }),
  summarizeThread: async ({ events }) => ({
    summary: events.map((event) => event.heading).join('; '),
    model: 'replay-deterministic',
  }),
  developStory: async () => ({
    title: '',
    narrative: '',
    status: 'open',
    model: 'replay-deterministic',
  }),
};
