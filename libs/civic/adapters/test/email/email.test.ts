import { createHash } from 'node:crypto';
import type {
  BlobRef,
  BlobStore,
  FetchContext,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import { ContentScanError } from '@optimistic-tanuki/civic-core';
import { createEmailAdapter } from '../../src/email/index.js';
import type { MailMessage, Mailbox } from '../../src/email/mailbox.js';

const NOW = new Date('2026-09-30T12:00:00Z');

function memoryBlobStore(): BlobStore {
  const blobs = new Map<string, Uint8Array>();
  return {
    async put(input: Uint8Array, contentType: string): Promise<BlobRef> {
      const sha256 = createHash('sha256').update(input).digest('hex');
      blobs.set(sha256, input);
      return {
        store: 'memory',
        key: sha256,
        sha256,
        bytes: input.byteLength,
        contentType,
      };
    },
    async get(ref: BlobRef): Promise<Uint8Array> {
      const blob = blobs.get(ref.sha256);
      if (!blob) throw new Error('blob not found');
      return blob;
    },
    async has(ref: BlobRef): Promise<boolean> {
      return blobs.has(ref.sha256);
    },
  };
}

/** A fake inbox that, like the real one, honours `since` and `from`. */
function fakeMailbox(messages: MailMessage[]): Mailbox & {
  calls: { since: Date; from: readonly string[] }[];
} {
  const calls: { since: Date; from: readonly string[] }[] = [];
  return {
    calls,
    async messagesSince(since, options) {
      calls.push({ since, from: options.from });
      return messages;
    },
  };
}

function message(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: '<a1@cityofadelga.gov>',
    from: 'clerk@cityofadelga.gov',
    subject: 'Council agenda for October 6',
    date: '2026-09-29T15:00:00.000Z',
    text: 'The council meets Monday.',
    attachments: [],
    ...overrides,
  };
}

function source(config?: Record<string, unknown>): SourceConfig {
  return {
    sourceKey: 'adelga-email',
    ownerSlug: 'adelga',
    coverage: 'mentions',
    adapter: 'email',
    name: 'Adelga notices',
    url: 'mailto:notices@example.test',
    kind: 'meeting',
    config,
  };
}

function context(blobStore?: BlobStore): FetchContext {
  return {
    locality: {} as FetchContext['locality'],
    httpClient: {
      fetch: async () => {
        throw new Error('email must not use HTTP');
      },
    },
    ...(blobStore ? { blobStore } : {}),
  };
}

function pdf(text: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${
    objects.length + 1
  } /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(body));
}

async function fetchWith(
  messages: MailMessage[],
  config: Record<string, unknown> | undefined,
  blobStore?: BlobStore
) {
  const mailbox = fakeMailbox(messages);
  const adapter = createEmailAdapter(mailbox, { now: () => NOW });
  const results = await adapter.fetch(source(config), context(blobStore));
  return { results, mailbox, adapter };
}

describe('email adapter fetch', () => {
  it('keeps allowed sender addresses and domains, and ignores others', async () => {
    const messages = [
      message({ id: '<1@x>', from: 'clerk@cityofadelga.gov' }),
      message({ id: '<2@x>', from: 'mayor@other.example' }),
      message({ id: '<3@x>', from: 'news@sub.cityofadelga.gov' }),
      message({ id: '<4@x>', from: 'noreply@lists.example' }),
      message({ id: '<5@x>', from: 'hr@lists.example' }),
    ];
    const { results } = await fetchWith(messages, {
      from: ['@CityOfAdelga.gov', 'noreply@lists.example'],
    });
    expect(results.map((r) => r.url)).toStrictEqual([
      'email:%3C1%40x%3E',
      'email:%3C4%40x%3E',
    ]);
  });

  it('matches a bare domain entry', async () => {
    const { results } = await fetchWith([message()], {
      from: ['cityofadelga.gov'],
    });
    expect(results).toHaveLength(1);
  });

  it('asks the mailbox for the lookback window from the injected clock', async () => {
    const old = message({ id: '<old@x>', date: '2026-08-01T00:00:00.000Z' });
    const recent = message({ id: '<new@x>', date: '2026-09-25T00:00:00.000Z' });
    const { results, mailbox } = await fetchWith([old, recent], {
      from: ['cityofadelga.gov'],
      lookbackDays: 10,
    });
    expect(mailbox.calls[0]?.since.toISOString()).toBe(
      '2026-09-20T12:00:00.000Z'
    );
    expect(results.map((r) => r.url)).toStrictEqual(['email:%3Cnew%40x%3E']);
  });

  it('defaults the lookback to 30 days', async () => {
    const { mailbox } = await fetchWith([], { from: ['cityofadelga.gov'] });
    expect(mailbox.calls[0]?.since.toISOString()).toBe(
      '2026-08-31T12:00:00.000Z'
    );
  });

  it('keeps only subjects matching subjectPattern', async () => {
    const messages = [
      message({ id: '<1@x>', subject: 'Council Agenda' }),
      message({ id: '<2@x>', subject: 'Pool hours' }),
    ];
    const { results } = await fetchWith(messages, {
      from: ['cityofadelga.gov'],
      subjectPattern: 'agenda|minutes',
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toBe('email:%3C1%40x%3E');
  });

  it('returns one text result per message with a header block', async () => {
    const { results } = await fetchWith([message()], {
      from: ['cityofadelga.gov'],
    });
    const [result] = results;
    expect(result?.kind).toBe('fetched');
    expect(result?.contentType).toBe('text/plain');
    expect(result?.status).toBe(200);
    expect(result?.payload).toStrictEqual({
      kind: 'text',
      body: [
        'Subject: Council agenda for October 6',
        'From: clerk@cityofadelga.gov',
        'Date: 2026-09-29T15:00:00.000Z',
        '',
        'The council meets Monday.',
      ].join('\n'),
    });
  });

  it('records an infected attachment as failed and keeps the message (D22)', async () => {
    const inner = memoryBlobStore();
    const store: BlobStore = {
      ...inner,
      put: async () => {
        throw new ContentScanError(
          'virus scan (test) found Eicar-Test-Signature; the document was not stored',
          'infected',
          'policy',
          false,
          ['Eicar-Test-Signature']
        );
      },
    };
    const { results } = await fetchWith(
      [
        message({
          attachments: [
            {
              filename: 'Agenda.pdf',
              contentType: 'application/pdf',
              content: pdf('Agenda'),
            },
          ],
        }),
      ],
      { from: ['cityofadelga.gov'] },
      store
    );
    expect(results.map((r) => r.kind)).toStrictEqual(['fetched', 'failed']);
    const failed = results[1];
    if (failed?.kind !== 'failed') throw new Error('expected a failed result');
    expect(failed.error).toMatchObject({
      kind: 'policy',
      code: 'infected',
      retryable: false,
    });
  });

  it('stores PDF attachments as blob refs and ignores other attachments', async () => {
    const store = memoryBlobStore();
    const bytes = pdf('Agenda');
    const { results } = await fetchWith(
      [
        message({
          attachments: [
            {
              filename: 'Agenda 10-06.pdf',
              contentType: 'application/pdf',
              content: bytes,
            },
            {
              filename: 'scan.PDF',
              contentType: 'application/octet-stream',
              content: bytes,
            },
            {
              filename: 'logo.png',
              contentType: 'image/png',
              content: new Uint8Array([1]),
            },
          ],
        }),
      ],
      { from: ['cityofadelga.gov'] },
      store
    );
    const pdfs = results.filter((r) => r.contentType === 'application/pdf');
    expect(results).toHaveLength(3);
    expect(pdfs.map((r) => r.url.split('?')[0])).toStrictEqual([
      'email:%3Ca1%40cityofadelga.gov%3E/Agenda%2010-06.pdf',
      'email:%3Ca1%40cityofadelga.gov%3E/scan.PDF',
    ]);
    const payload = pdfs[0]?.payload;
    expect(payload?.kind).toBe('blob-ref');
    if (payload?.kind !== 'blob-ref') return;
    expect(await store.get(payload.ref)).toStrictEqual(bytes);
  });

  it('skips attachments when the context has no blob store', async () => {
    const { results } = await fetchWith(
      [
        message({
          attachments: [
            {
              filename: 'a.pdf',
              contentType: 'application/pdf',
              content: pdf('A'),
            },
          ],
        }),
      ],
      { from: ['cityofadelga.gov'] }
    );
    expect(results).toHaveLength(1);
  });

  it.each([
    ['no config', undefined],
    ['empty from', { from: [] }],
    ['non-string from', { from: [3] }],
    ['bad lookback', { from: ['a.gov'], lookbackDays: 0 }],
    ['bad regexp', { from: ['a.gov'], subjectPattern: '(' }],
  ])('reports a failed result for invalid config: %s', async (_, config) => {
    const { results, mailbox } = await fetchWith([message()], config);
    expect(results).toHaveLength(1);
    expect(results[0]?.kind).toBe('failed');
    expect(mailbox.calls).toHaveLength(0);
  });

  it('reports a failed result when the mailbox cannot be read', async () => {
    const adapter = createEmailAdapter(
      {
        messagesSince: async () => {
          throw new Error('login refused');
        },
      },
      { now: () => NOW }
    );
    const results = await adapter.fetch(source({ from: ['a.gov'] }), context());
    expect(results[0]?.kind).toBe('failed');
  });
});

describe('email adapter parse', () => {
  const adapter = createEmailAdapter(fakeMailbox([]), { now: () => NOW });

  async function parseMessage(m: MailMessage) {
    const { results } = await fetchWith([m], { from: ['cityofadelga.gov'] });
    const result = results[0];
    if (result?.kind !== 'fetched') throw new Error('expected fetched');
    return adapter.parse(
      {
        url: result.url,
        contentType: result.contentType,
        payload: result.payload,
        fetchedAt: result.fetchedAt,
      },
      source({ from: ['cityofadelga.gov'] })
    );
  }

  it('maps a text record to one draft item', async () => {
    const items = await parseMessage(
      message({ subject: '  Council agenda for October 6 ' })
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Council agenda for October 6',
      body: 'The council meets Monday.',
      kind: 'meeting',
      publishedAt: '2026-09-29T15:00:00.000Z',
      uris: ['email:%3Ca1%40cityofadelga.gov%3E'],
    });
  });

  it('strips signature and unsubscribe footers', async () => {
    const items = await parseMessage(
      message({
        text: [
          'Agenda attached.',
          '',
          'Bring questions.',
          '',
          '-- ',
          'Clerk, City of Adelga',
        ].join('\n'),
      })
    );
    expect(items[0]?.body).toBe('Agenda attached.\n\nBring questions.');
    const footer = await parseMessage(
      message({
        text: [
          'Pool closes Friday.',
          '',
          '________________',
          'You are receiving this because you subscribed.',
          'Unsubscribe | Manage your subscription',
          'City of Adelga, 1 Main St',
        ].join('\n'),
      })
    );
    expect(footer[0]?.body).toBe('Pool closes Friday.');
  });

  it('prefers a link on the sender domain, else the email url', async () => {
    const withLinks = await parseMessage(
      message({
        text: 'See https://tracker.example/x?u=1 or https://cityofadelga.gov/agenda/1042.',
      })
    );
    expect(withLinks[0]?.uris).toStrictEqual([
      'https://cityofadelga.gov/agenda/1042',
    ]);
    const foreign = await parseMessage(
      message({ text: 'See https://tracker.example/x' })
    );
    expect(foreign[0]?.uris).toStrictEqual([
      'email:%3Ca1%40cityofadelga.gov%3E',
    ]);
  });

  it('extracts a PDF attachment into a draft item', async () => {
    const store = memoryBlobStore();
    const { results } = await fetchWith(
      [
        message({
          attachments: [
            {
              filename: 'Agenda 10-06.pdf',
              contentType: 'application/pdf',
              content: pdf('Regular Meeting Agenda Call to order'),
            },
          ],
        }),
      ],
      { from: ['cityofadelga.gov'] },
      store
    );
    const result = results.find((r) => r.contentType === 'application/pdf');
    if (result?.kind !== 'fetched') throw new Error('expected a pdf result');
    const items = await adapter.parse(
      {
        url: result.url,
        contentType: result.contentType,
        payload: result.payload,
        fetchedAt: result.fetchedAt,
      },
      source({ from: ['cityofadelga.gov'] }),
      { blobStore: store }
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe(
      'Agenda 10-06.pdf — Council agenda for October 6'
    );
    expect(items[0]?.body).toContain('Regular Meeting Agenda');
    expect(items[0]?.publishedAt).toBe('2026-09-29T15:00:00.000Z');
  });
});
