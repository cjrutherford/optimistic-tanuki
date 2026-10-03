import * as cheerio from 'cheerio';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  DraftItem,
  FetchContext,
  FetchError,
  FetchResult,
  RawDocumentInput,
  BlobStore,
  HttpClient,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { titleFromUrl, pageBase } from '../http-scrape/index.js';
import {
  meetingDateFromDocumentText,
  meetingDateFromTitle,
  meetingDocumentTitle,
  truncate,
} from '@optimistic-tanuki/civic-core';
import {
  ContentScanError,
  createLocalBlobStore,
} from '@optimistic-tanuki/civic-core';
import {
  OutboundPolicy,
  restrictedPublisherDomains,
} from '@optimistic-tanuki/civic-core';
import { ocrPdfBytes } from './ocr.js';
import { extractDocxText, isDocx } from './docx.js';

const DOCX_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';
const MAX_BYTES = 25 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_INDEX_PAGES = 12;
const DEFAULT_MAX_DOCS = 50;
export const BODY_CHAR_CAP = 12_000;
// Native pdfjs text shorter than this is treated as scanned and OCR is attempted.
const OCR_THRESHOLD = 300;
const DEFAULT_BLOB_STORE = createLocalBlobStore('data/blobs');
export type DocumentOcr = (
  bytes: Uint8Array,
  opts?: { lang?: string; cacheDir?: string }
) => Promise<string>;
export interface DocumentAdapterOptions {
  ocrCacheDir?: string;
  outboundPolicy?: OutboundPolicy;
}

export class DocumentDownloadError extends Error {
  readonly kind: FetchError['kind'];
  readonly code: string;
  readonly url: string;
  readonly status: number | null;
  readonly bytes?: number;
  readonly checksum?: string;
  readonly retryable: boolean;

  constructor(options: {
    code: string;
    kind: FetchError['kind'];
    url: string;
    status?: number | null;
    bytes?: number;
    checksum?: string;
    retryable?: boolean;
    detail: string;
  }) {
    const status = options.status ?? null;
    const diagnostics = `url=${options.url} status=${status ?? 'unknown'}${
      options.bytes === undefined ? '' : ` bytes=${options.bytes}`
    }${options.checksum ? ` checksum=${options.checksum}` : ''}`;
    super(`${options.detail} (${diagnostics})`);
    this.name = 'DocumentDownloadError';
    this.kind = options.kind;
    this.code = options.code;
    this.url = options.url;
    this.status = status;
    this.bytes = options.bytes;
    this.checksum = options.checksum;
    this.retryable = options.retryable ?? false;
  }
}

export class DocumentParseError extends Error {
  readonly kind = 'decode' as const;
  readonly code: string;
  readonly url: string;
  readonly bytes: number;
  readonly checksum: string;
  readonly retryable = false;

  constructor(
    code: string,
    url: string,
    bytes: number,
    checksum: string,
    detail: string
  ) {
    super(`${detail} (url=${url} bytes=${bytes} checksum=${checksum})`);
    this.name = 'DocumentParseError';
    this.code = code;
    this.url = url;
    this.bytes = bytes;
    this.checksum = checksum;
  }
}

function diagnosticFetchError(error: unknown, fallbackUrl: string): FetchError {
  // The blob store's virus scan (D22): infected files are a policy refusal,
  // a scanner outage is retried.
  if (error instanceof ContentScanError) {
    return {
      kind: error.kind,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      url: fallbackUrl,
    };
  }
  if (error instanceof DocumentDownloadError) {
    return {
      kind: error.kind,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.status === null ? {} : { status: error.status }),
      url: error.url,
      ...(error.bytes === undefined ? {} : { bytes: error.bytes }),
      ...(error.checksum === undefined ? {} : { checksum: error.checksum }),
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  const kind: FetchError['kind'] = /timeout|abort/i.test(message)
    ? 'timeout'
    : /HTTP\s+\d+/i.test(message)
    ? 'http'
    : 'network';
  return {
    kind,
    message,
    retryable: kind === 'network' || kind === 'timeout',
    url: fallbackUrl,
  };
}

function titleCaseHeading(value: string): string {
  return value
    .replace(/[|]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase()
    .replace(/\b[a-z]/gu, (letter) => letter.toLocaleUpperCase());
}

/** Build a useful title from OCR headings instead of exposing a raw scan header. */
function ocrDocumentTitle(text: string): string | undefined {
  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  const meeting = lines.find((line) =>
    /\b(?:council|commission|board)\s+meeting\b/iu.test(line)
  );
  const agenda = lines.find(
    (line) => /^agenda$/iu.test(line) || /\bagenda\b/iu.test(line)
  );
  const date = lines.find(
    (line) =>
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2}(?:,?\s+\d{4})?\b/iu.test(
        line
      ) || /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/u.test(line)
  );
  if (!meeting && !agenda && !date) return undefined;
  const heading = [meeting, agenda]
    .filter(Boolean)
    .map((line) => titleCaseHeading(line!))
    .join(' ');
  const cleanDate = date?.replace(/\s+/gu, ' ').trim();
  return [heading || 'Meeting Agenda', cleanDate ? `— ${cleanDate}` : '']
    .filter(Boolean)
    .join(' ');
}

async function downloadPdf(
  url: string,
  blobStore: BlobStore,
  httpClient: HttpClient
) {
  // Municipal sites often serve documents from their CMS host ("cms5.revize.com").
  // Public redirects are allowed; private addresses and restricted publishers are still refused.
  // The adapter's own limit, not the policy's general 2 MB: a council packet
  // with its attachments is routinely ten or twenty.
  const res = await httpClient.fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    maxBytes: MAX_BYTES,
    policy: {
      allowPublicCrossOriginRedirects: true,
      deniedRegistrableDomains: restrictedPublisherDomains(),
    },
  });
  if (!res.ok) {
    throw new DocumentDownloadError({
      code: 'http-status',
      kind: 'http',
      url,
      status: res.status,
      retryable: res.status >= 500,
      detail: `HTTP ${res.status} for ${url}`,
    });
  }
  const type = res.headers.get('content-type') ?? '';
  const length = Number(res.headers.get('content-length') ?? 0);
  if (length > MAX_BYTES)
    throw new DocumentDownloadError({
      code: 'pdf-too-large',
      kind: 'size',
      url,
      status: res.status,
      retryable: false,
      detail: `PDF over ${MAX_BYTES} bytes: ${url}`,
    });
  const buf = Buffer.from(await res.arrayBuffer());
  const checksum = createHash('sha256').update(buf).digest('hex');
  if (buf.length === 0) {
    throw new DocumentDownloadError({
      code: 'empty-pdf-body',
      kind: 'decode',
      url,
      status: res.status,
      bytes: 0,
      checksum,
      retryable: true,
      detail: 'PDF response body is empty',
    });
  }
  if (buf.length > MAX_BYTES)
    throw new DocumentDownloadError({
      code: 'pdf-too-large',
      kind: 'size',
      url,
      status: res.status,
      bytes: buf.length,
      checksum,
      retryable: false,
      detail: `PDF over cap after download: ${url}`,
    });
  if (isDocx(buf)) return blobStore.put(new Uint8Array(buf), DOCX_TYPE);
  if (buf.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new DocumentDownloadError({
      code: 'invalid-pdf-signature',
      kind: 'decode',
      url,
      status: res.status,
      bytes: buf.length,
      checksum,
      retryable: false,
      detail: 'Downloaded response has an invalid PDF signature',
    });
  }
  if (!/pdf/i.test(type) && !/ViewFile/i.test(url)) {
    throw new DocumentDownloadError({
      code: 'not-pdf-content-type',
      kind: 'decode',
      url,
      status: res.status,
      bytes: buf.length,
      checksum,
      retryable: false,
      detail: `Not a PDF (${type})`,
    });
  }
  return blobStore.put(new Uint8Array(buf), type || 'application/pdf');
}

export async function extractPdfText(data: Uint8Array): Promise<string> {
  // pdfjs may transfer/detach the supplied typed-array buffer while opening
  // the document. Keep the caller's bytes intact because scanned documents
  // pass the same bytes to the OCR fallback after native extraction.
  const doc = await pdfjs.getDocument({
    data: data.slice(),
    useSystemFonts: true,
  }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 60); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((i) => ('str' in i ? (i.str as string) : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
  await doc.destroy();
  return pages.join('\n\n').trim();
}

/**
 * Document adapter. Source config: { indexUrl, linkPattern, enableOcr?, ocrLang? }.
 * Downloads linked PDFs to data/docs/<hash>.pdf, extracts native text via pdfjs,
 * falls back to Tesseract OCR (pdftoppm + tesseract 5.5) for scanned-image PDFs.
 * OCR results are cached to <hash>.pdf.ocr.txt for instant re-parses.
 */
export function createDocumentAdapter(
  blobStore: BlobStore = DEFAULT_BLOB_STORE,
  ocr: DocumentOcr = ocrPdfBytes,
  options: DocumentAdapterOptions = {}
): SourceAdapter {
  const ocrCacheDir =
    options.ocrCacheDir ?? join(process.cwd(), 'data', 'ocr-cache');
  const outboundPolicy = options.outboundPolicy ?? new OutboundPolicy();
  return {
    name: 'document',

    async fetch(
      source: SourceConfig,
      ctx: FetchContext
    ): Promise<FetchResult[]> {
      const storage = ctx.blobStore ?? blobStore;
      const client = options.outboundPolicy ?? ctx.httpClient;
      const policy =
        options.outboundPolicy ??
        (ctx.httpClient.validate
          ? (ctx.httpClient as Required<
              Pick<typeof ctx.httpClient, 'validate'>
            >)
          : outboundPolicy);
      try {
        const indexUrl = (source.config?.['indexUrl'] as string) ?? source.url;
        const pattern = new RegExp(
          (source.config?.['linkPattern'] as string) ?? '\\.pdf$'
        );
        const maxDocs =
          (source.config?.['maxDocs'] as number) ?? DEFAULT_MAX_DOCS;
        // Some platforms list meetings on the index and keep documents one level
        // deeper (index -> meeting -> files). `indexLinkPattern` follows that one
        // extra level, bounded by `maxIndexPages`.
        const indexLinkPattern =
          source.config?.['indexLinkPattern'] === undefined
            ? null
            : new RegExp(source.config['indexLinkPattern'] as string);
        const maxIndexPages =
          (source.config?.['maxIndexPages'] as number) ??
          DEFAULT_MAX_INDEX_PAGES;
        const seen = new Set<string>();
        const candidates: { url: string; anchorText: string }[] = [];
        const now = new Date().toISOString();
        const collect = async (pageUrl: string): Promise<string[]> => {
          const response = await client.fetch(pageUrl, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!response.ok)
            throw new Error(`HTTP ${response.status} for ${pageUrl}`);
          const page = cheerio.load(await response.text());
          const pageBaseUrl = pageBase(page, pageUrl);
          const followed: string[] = [];
          page('a[href]').each((_, el) => {
            const href = page(el).attr('href') ?? '';
            const anchorText = page(el).text().trim();
            if (pattern.test(href)) {
              const abs = new URL(href, pageBaseUrl).toString();
              if (seen.has(abs)) return;
              seen.add(abs);
              candidates.push({ url: abs, anchorText });
              return;
            }
            if (indexLinkPattern?.test(href))
              followed.push(new URL(href, pageBaseUrl).toString());
          });
          return followed;
        };
        const followedPages = await collect(indexUrl);
        if (indexLinkPattern) {
          const visited = new Set<string>();
          for (const pageUrl of followedPages) {
            if (visited.size >= maxIndexPages) break;
            if (visited.has(pageUrl)) continue;
            visited.add(pageUrl);
            try {
              await policy.validate(pageUrl, indexUrl);
              await collect(pageUrl);
            } catch {
              // A single unreachable or out-of-policy meeting page never fails the source.
            }
          }
        }
        // Links are checked before download; redirects are revalidated by policy.fetch.
        const out: FetchResult[] = [];
        for (const candidate of candidates) {
          try {
            await policy.validate(candidate.url, indexUrl);
            out.push({
              kind: 'fetched',
              status: 200,
              url: candidate.url,
              requestUrl: indexUrl,
              contentType: 'application/pdf-pending',
              payload: {
                kind: 'text',
                body: JSON.stringify({ anchorText: candidate.anchorText }),
              },
              fetchedAt: now,
            });
          } catch {
            // Ignore links outside the configured outbound policy.
          }
        }
        // Resolve downloads now so RawDocuments are content-complete (bounded).
        const resolved: FetchResult[] = [];
        for (const link of out.slice(0, maxDocs)) {
          try {
            const ref = await downloadPdf(link.url, storage, client);
            resolved.push({
              kind: 'fetched',
              status: 200,
              url: link.url,
              requestUrl: indexUrl,
              contentType: 'application/pdf',
              payload: { kind: 'blob-ref', ref },
              fetchedAt: link.fetchedAt,
            });
          } catch (error) {
            const failure = diagnosticFetchError(error, link.url);
            resolved.push({
              kind: 'failed',
              status:
                error instanceof DocumentDownloadError ? error.status : null,
              url: link.url,
              requestUrl: indexUrl,
              contentType: 'application/pdf',
              fetchedAt: link.fetchedAt,
              error: failure,
            });
          }
        }
        return resolved;
      } catch (error) {
        const failure = diagnosticFetchError(error, source.url);
        return [
          {
            kind: 'failed',
            status:
              error instanceof DocumentDownloadError ? error.status : null,
            url: source.url,
            requestUrl: source.url,
            contentType: 'text/html',
            fetchedAt: new Date().toISOString(),
            error: failure,
          },
        ];
      }
    },

    async parse(
      raw: RawDocumentInput,
      source: SourceConfig,
      ctx
    ): Promise<DraftItem[]> {
      if (raw.payload.kind !== 'blob-ref') return [];
      const pdfBytes = await (ctx?.blobStore ?? blobStore).get(raw.payload.ref);
      const digest = createHash('sha256').update(pdfBytes).digest('hex');
      if (pdfBytes.length === 0)
        throw new DocumentParseError(
          'empty-pdf-body',
          raw.url,
          0,
          digest,
          'PDF payload is empty'
        );
      let text = '';
      let nativeError: unknown;
      try {
        text = isDocx(pdfBytes)
          ? extractDocxText(pdfBytes)
          : await extractPdfText(pdfBytes);
      } catch (error) {
        nativeError = error;
      }
      let ocrUsed = false;
      // Fallback to Tesseract OCR for scanned-image PDFs (native text empty or trivially short).
      if (!isDocx(pdfBytes) && text.trim().length < OCR_THRESHOLD) {
        try {
          const cachePath = join(
            ocrCacheDir,
            'sha256',
            digest.slice(0, 2),
            `${digest}.txt`
          );
          let ocrText = existsSync(cachePath)
            ? readFileSync(cachePath, 'utf8')
            : '';
          if (!ocrText.trim()) {
            ocrText = await ocr(pdfBytes, {
              lang: (source.config?.['ocrLang'] as string) ?? 'eng',
              cacheDir: ocrCacheDir,
            });
            if (ocrText.trim()) {
              mkdirSync(dirname(cachePath), { recursive: true });
              writeFileSync(cachePath, ocrText.trim());
            }
          }
          if (ocrText.trim()) {
            text = ocrText.trim();
            ocrUsed = true;
          } else {
            throw new DocumentParseError(
              'ocr-empty',
              raw.url,
              pdfBytes.length,
              digest,
              `OCR produced empty output${
                nativeError instanceof Error
                  ? ` after native extraction failed: ${nativeError.message}`
                  : ''
              }`
            );
          }
        } catch (error) {
          if (error instanceof DocumentParseError) throw error;
          throw new DocumentParseError(
            'ocr-failed',
            raw.url,
            pdfBytes.length,
            digest,
            `OCR failed: ${
              error instanceof Error ? error.message : String(error)
            }${
              nativeError instanceof Error
                ? `; native extraction failed: ${nativeError.message}`
                : ''
            }`
          );
        }
      }
      if (!text.trim()) {
        throw new DocumentParseError(
          'empty-document-text',
          raw.url,
          pdfBytes.length,
          digest,
          'Document text extraction produced no output'
        );
      }
      const firstLine = truncate(text.split('\n')[0] ?? '', 200);
      const topics: string[] | undefined = ocrUsed
        ? source.kind === 'meeting'
          ? ['government', 'meetings']
          : [source.kind]
        : undefined;
      const urlTitle = titleFromUrl(raw.url);
      // Platforms that serve documents under opaque ids ("file/getfile/109363")
      // leave nothing in the URL; the cover page names the body and the meeting.
      const title =
        (ocrUsed ? ocrDocumentTitle(text) : undefined) ||
        (urlTitle && meetingDateFromTitle(urlTitle) ? urlTitle : undefined) ||
        meetingDocumentTitle(text) ||
        urlTitle ||
        firstLine ||
        'Document';
      // Event date from title first, then URL-derived date (ViewFile/_MMDDYYYY), then the document itself.
      const eventDate =
        meetingDateFromTitle(title) ??
        meetingDateFromTitle(urlTitle ?? '') ??
        meetingDateFromDocumentText(text) ??
        undefined;
      return [
        {
          title,
          body: text.slice(0, BODY_CHAR_CAP),
          kind: source.kind,
          eventDate,
          topics,
          uris: [raw.url],
        },
      ];
    },
  };
}

export const documentAdapter: SourceAdapter = createDocumentAdapter();
