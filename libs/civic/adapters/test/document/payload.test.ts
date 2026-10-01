import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import {
  createDocumentAdapter,
  documentAdapter,
  DocumentParseError,
} from '../../src/document/index.js';
import {
  createLocalBlobStore,
  OutboundPolicy,
} from '@optimistic-tanuki/civic-core';
import type { HttpResponse } from '@optimistic-tanuki/civic-core';

async function captureRejection(
  p: Promise<unknown> | (() => Promise<unknown>)
): Promise<unknown> {
  try {
    await (typeof p === 'function' ? p() : p);
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}
const source = {
  sourceKey: 'document-test',
  ownerSlug: 'town-a',
  coverage: 'mentions' as const,
  adapter: 'document',
  name: 'Documents',
  url: 'https://example.test/docs',
  kind: 'meeting' as const,
};

function response(
  body: BodyInit,
  contentType = 'application/pdf',
  status = 200
): HttpResponse {
  return Object.assign(
    new Response(body, { status, headers: { 'content-type': contentType } }),
    {
      finalUrl: 'https://example.test/docs',
      redirectChain: ['https://example.test/docs'],
    }
  ) as HttpResponse;
}

function documentFetchAdapter(pdfBody: BodyInit) {
  const policy = new OutboundPolicy({
    resolveHostname: async () => ['93.184.216.34'],
    fetch: async (input) =>
      input.endsWith('/docs')
        ? new Response('<a href="/agenda.pdf">agenda</a>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          })
        : response(pdfBody),
  });
  return createDocumentAdapter(undefined, undefined, {
    outboundPolicy: policy,
  });
}

function shortTextPdf(): Uint8Array {
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    '5 0 obj\n<< /Length 36 >>\nstream\nBT /F1 12 Tf 72 720 Td (Hello) Tj ET\nendstream\nendobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body));
}

describe('document payload contract', () => {
  it('does not parse a transient text link as document content', async () => {
    const items = await documentAdapter.parse(
      {
        url: 'https://example.test/agenda.pdf',
        contentType: 'application/pdf',
        payload: { kind: 'text', body: '/tmp/agenda.pdf' },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source
    );
    expect(items).toStrictEqual([]);
  });

  it('resolves blobs through the injected store and invokes OCR for short native text', async () => {
    let gets = 0;
    let ocrCalls = 0;
    const bytes = new Uint8Array([1, 2, 3]);
    const ref = {
      store: 'injected',
      key: 'sha256/aa/hash',
      sha256: 'aa'.repeat(32),
      bytes: 3,
      contentType: 'application/pdf',
    };
    const cacheDir = mkdtempSync(join(tmpdir(), 'civic-ocr-cache-'));
    const defaultStore = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        throw new Error('default blob store must not be used');
      },
    };
    const adapter = createDocumentAdapter(
      defaultStore,
      async () => {
        ocrCalls += 1;
        return 'OCR text from durable bytes '.repeat(10);
      },
      { ocrCacheDir: cacheDir }
    );
    const runtimeStore = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        gets += 1;
        return bytes;
      },
    };
    try {
      const input = {
        url: 'https://example.test/agenda.pdf',
        contentType: 'application/pdf',
        payload: { kind: 'blob-ref' as const, ref },
        fetchedAt: '2026-09-12T00:00:00Z',
      };
      const [item] = await adapter.parse(input, source, {
        blobStore: runtimeStore,
      });
      const [cached] = await adapter.parse(input, source, {
        blobStore: runtimeStore,
      });
      expect(gets).toBe(2);
      expect(ocrCalls).toBe(1);
      expect(item?.body ?? '').toMatch(/OCR text/);
      expect(cached?.body).toBe(item?.body);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('preserves PDF bytes for OCR after native pdfjs extraction transfers its input buffer', async () => {
    const bytes = shortTextPdf();
    const ref = {
      store: 'injected',
      key: 'sha256/bb/hash',
      sha256: 'bb'.repeat(32),
      bytes: bytes.length,
      contentType: 'application/pdf',
    };
    const cacheDir = mkdtempSync(join(tmpdir(), 'civic-ocr-buffer-cache-'));
    let ocrInputBytes = 0;
    const runtimeStore = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        return bytes;
      },
    };
    const adapter = createDocumentAdapter(
      runtimeStore,
      async (ocrBytes) => {
        ocrInputBytes = ocrBytes.byteLength;
        return 'OCR recovered text '.repeat(20);
      },
      { ocrCacheDir: cacheDir }
    );
    try {
      const [item] = await adapter.parse(
        {
          url: 'https://example.test/scanned.pdf',
          contentType: 'application/pdf',
          payload: { kind: 'blob-ref', ref },
          fetchedAt: '2026-09-12T00:00:00Z',
        },
        source,
        { blobStore: runtimeStore }
      );
      expect(ocrInputBytes > 0).toBeTruthy();
      expect(item?.body ?? '').toMatch(/OCR recovered text/);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('does not fetch a cross-origin document link from an allowed index', async () => {
    const policy = new OutboundPolicy({
      resolveHostname: async () => ['93.184.216.34'],
      fetch: async () =>
        new Response('<a href="https://evil.test/private.pdf">agenda</a>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    });
    const adapter = createDocumentAdapter(undefined, undefined, {
      outboundPolicy: policy,
    });
    const results = await adapter.fetch(source, {
      locality: {} as never,
      httpClient: {
        fetch: async (input: string) =>
          Object.assign(new Response(''), {
            finalUrl: input,
            redirectChain: [input],
          }) as HttpResponse,
      },
    });
    expect(results).toStrictEqual([]);
  });

  it('fails closed on an empty PDF response with structured diagnostics', async () => {
    const url = 'https://example.test/agenda.pdf';
    const [result] = await documentFetchAdapter(new Uint8Array()).fetch(
      source,
      { locality: {} as never, httpClient: {} as never }
    );
    expect(result?.kind).toBe('failed');
    if (result?.kind !== 'failed') return;
    expect(result.status).toBe(200);
    expect(result.error.kind).toBe('decode');
    expect(result.error.code).toBe('empty-pdf-body');
    expect(result.error.url).toBe(url);
    expect(result.error.bytes).toBe(0);
    expect(result.error.checksum).toBe(
      createHash('sha256').update(new Uint8Array()).digest('hex')
    );
    expect(result.error.message).toMatch(/status=200/);
    expect(result.error.message).toMatch(/bytes=0/);
  });

  it('fails closed on a non-PDF response even when HTTP succeeds', async () => {
    const bytes = Buffer.from('not a pdf');
    const [result] = await documentFetchAdapter(bytes).fetch(source, {
      locality: {} as never,
      httpClient: {} as never,
    });
    expect(result?.kind).toBe('failed');
    if (result?.kind !== 'failed') return;
    expect(result.status).toBe(200);
    expect(result.error.kind).toBe('decode');
    expect(result.error.code).toBe('invalid-pdf-signature');
    expect(result.error.bytes).toBe(bytes.length);
    expect(result.error.checksum).toBe(
      createHash('sha256').update(bytes).digest('hex')
    );
    expect(result.error.message).toMatch(/invalid PDF signature/);
  });

  it('propagates OCR exceptions as diagnostics and emits no placeholder item', async () => {
    const bytes = shortTextPdf();
    const ref = {
      store: 'injected',
      key: 'sha256/cc/hash',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      contentType: 'application/pdf',
    };
    const store = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        return bytes;
      },
    };
    const cacheDir = mkdtempSync(join(tmpdir(), 'civic-ocr-failure-cache-'));
    const adapter = createDocumentAdapter(
      store,
      async () => {
        throw new Error('tesseract crashed');
      },
      { ocrCacheDir: cacheDir }
    );
    try {
      await expect(
        ((error: unknown) => {
          expect(error instanceof DocumentParseError).toBeTruthy();
          expect((error as DocumentParseError).code).toBe('ocr-failed');
          expect((error as DocumentParseError).url).toBe(
            'https://example.test/scan.pdf'
          );
          expect((error as DocumentParseError).bytes).toBe(bytes.length);
          expect((error as Error).message).toMatch(/tesseract crashed/);
          expect((error as Error).message).not.toMatch(/\[needs_ocr\]/);
          return true;
        })(
          await captureRejection(() =>
            adapter.parse(
              {
                url: 'https://example.test/scan.pdf',
                contentType: 'application/pdf',
                payload: { kind: 'blob-ref', ref },
                fetchedAt: '2026-09-12T00:00:00Z',
              },
              source,
              { blobStore: store }
            )
          )
        )
      ).toBe(true);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('retains native pdfjs diagnostics when OCR cannot recover malformed bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const ref = {
      store: 'injected',
      key: 'sha256/ee/hash',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      contentType: 'application/pdf',
    };
    const store = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        return bytes;
      },
    };
    const adapter = createDocumentAdapter(store, async () => {
      throw new Error('ocr unavailable');
    });
    await expect(
      ((error: unknown) => {
        expect(error instanceof DocumentParseError).toBeTruthy();
        expect((error as DocumentParseError).code).toBe('ocr-failed');
        expect((error as Error).message).toMatch(/ocr unavailable/);
        expect((error as Error).message).toMatch(/native extraction failed/);
        return true;
      })(
        await captureRejection(() =>
          adapter.parse(
            {
              url: 'https://example.test/malformed.pdf',
              contentType: 'application/pdf',
              payload: { kind: 'blob-ref', ref },
              fetchedAt: '2026-09-12T00:00:00Z',
            },
            source,
            { blobStore: store }
          )
        )
      )
    ).toBe(true);
  });

  it('propagates empty OCR output and never returns a needs_ocr CivicItem', async () => {
    const bytes = shortTextPdf();
    const ref = {
      store: 'injected',
      key: 'sha256/dd/hash',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      contentType: 'application/pdf',
    };
    const store = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        return bytes;
      },
    };
    const cacheDir = mkdtempSync(join(tmpdir(), 'civic-ocr-empty-cache-'));
    const adapter = createDocumentAdapter(store, async () => '   ', {
      ocrCacheDir: cacheDir,
    });
    try {
      await expect(
        ((error: unknown) => {
          expect(error instanceof DocumentParseError).toBeTruthy();
          expect((error as DocumentParseError).code).toBe('ocr-empty');
          expect((error as Error).message).toMatch(/empty output/);
          return true;
        })(
          await captureRejection(() =>
            adapter.parse(
              {
                url: 'https://example.test/scan.pdf',
                contentType: 'application/pdf',
                payload: { kind: 'blob-ref', ref },
                fetchedAt: '2026-09-12T00:00:00Z',
              },
              source,
              { blobStore: store }
            )
          )
        )
      ).toBe(true);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it('derives a grounded meeting title, date, and editorial topics from OCR text', async () => {
    const bytes = shortTextPdf();
    const ref = {
      store: 'injected',
      key: 'sha256/ff/hash',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      contentType: 'application/pdf',
    };
    const store = {
      async put() {
        return ref;
      },
      async has() {
        return true;
      },
      async get() {
        return bytes;
      },
    };
    const adapter = createDocumentAdapter(
      store,
      async () =>
        'CITY OF ADE\nCOUNCIL MEETING\nAGENDA\nMarch 16, 2026\n1) CALL TO ORDER'
    );
    const [item] = await adapter.parse(
      {
        url: 'https://example.test/agenda-3-16-2026.pdf',
        contentType: 'application/pdf',
        payload: { kind: 'blob-ref', ref },
        fetchedAt: '2026-09-12T00:00:00Z',
      },
      source,
      { blobStore: store }
    );
    expect(item?.title ?? '').toMatch(/Council Meeting Agenda/i);
    expect(item?.title ?? '').toMatch(/March 16, 2026/i);
    expect(item?.eventDate).toBe('2026-03-16');
    expect(item?.topics).toStrictEqual(['government', 'meetings']);
    expect(item?.topics?.includes('ocr')).toBe(false);
  });
});

describe('two-level document index', () => {
  it('follows meeting pages from an index and collects their documents', async () => {
    const pages: Record<string, string> = {
      'https://portal.test/iip/town/meeting/list':
        '<html><body><a href="/iip/town/meeting/details/1">Council 09/16</a><a href="/iip/town/meeting/details/2">Board 09/10</a><a href="/iip/town/itemtracker/list">Item tracker</a></body></html>',
      'https://portal.test/iip/town/meeting/details/1':
        '<html><body><a href="/iip/town/file/getfile/11">Agenda</a><a href="/iip/town/file/getfile/12">Minutes</a></body></html>',
      'https://portal.test/iip/town/meeting/details/2':
        '<html><body><a href="/iip/town/file/getfile/21">Agenda packet</a></body></html>',
    };
    const requested: string[] = [];
    const httpClient = {
      fetch: async (url: string) => {
        requested.push(url);
        const body = pages[url];
        if (body !== undefined)
          return Object.assign(
            new Response(body, {
              status: 200,
              headers: { 'content-type': 'text/html' },
            }),
            { finalUrl: url, redirectChain: [url] }
          );
        // A document download: a minimal PDF.
        return Object.assign(
          new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1]), {
            status: 200,
            headers: { 'content-type': 'application/pdf' },
          }),
          { finalUrl: url, redirectChain: [url] }
        );
      },
      validate: async (value: string) => new URL(value),
    };
    const adapter = createDocumentAdapter(
      createLocalBlobStore(mkdtempSync(join(tmpdir(), 'civic-two-level-')))
    );
    const results = await adapter.fetch(
      {
        sourceKey: 'town-documents',
        ownerSlug: 'town-a',
        coverage: 'all',
        adapter: 'document',
        name: 'Town meeting documents',
        url: 'https://portal.test/iip/town/meeting/list',
        kind: 'meeting',
        config: {
          linkPattern: 'file/getfile',
          indexLinkPattern: 'meeting/details',
          maxIndexPages: 5,
        },
      },
      { locality: {} as never, httpClient: httpClient as never }
    );
    expect(results.map((result) => result.url)).toStrictEqual([
      'https://portal.test/iip/town/file/getfile/11',
      'https://portal.test/iip/town/file/getfile/12',
      'https://portal.test/iip/town/file/getfile/21',
    ]);
    expect(
      requested.includes('https://portal.test/iip/town/meeting/details/2')
    ).toBeTruthy();
    expect(
      !requested.includes('https://portal.test/iip/town/itemtracker/list')
    ).toBeTruthy();
  });
});
