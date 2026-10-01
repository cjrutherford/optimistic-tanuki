import type {
  DraftItem,
  FetchContext,
  FetchResult,
  RawDocumentInput,
  ParseContext,
  SourceAdapter,
  SourceConfig,
} from '@optimistic-tanuki/civic-core';
import {
  meetingDateFromDocumentText,
  meetingDateFromTitle,
} from '@optimistic-tanuki/civic-core';
import { BODY_CHAR_CAP, extractPdfText } from '../document/index.js';
import { senderMatches, type MailMessage, type Mailbox } from './mailbox.js';

const DEFAULT_LOOKBACK_DAYS = 30;
const DAY_MS = 86_400_000;

/** Source config for an email source (`SourceConfig.config`). */
export interface EmailSourceConfig {
  /** Allowed senders: full addresses or exact domains ("cityofadelga.gov", "@cityofadelga.gov"). */
  from: string[];
  /** How far back to read. Default 30. */
  lookbackDays?: number;
  /** RegExp source; only messages whose subject matches are kept. */
  subjectPattern?: string;
}

/** Checks `source.config`; returns the usable config or a message saying what is wrong. */
export function parseEmailConfig(
  source: SourceConfig
): { config: EmailSourceConfig; subject?: RegExp } | { error: string } {
  const raw = source.config ?? {};
  const from = raw['from'];
  if (
    !Array.isArray(from) ||
    from.length === 0 ||
    !from.every((entry) => typeof entry === 'string' && entry.trim() !== '')
  )
    return { error: 'email source needs config.from: a non-empty string[]' };
  const lookbackDays = raw['lookbackDays'];
  if (
    lookbackDays !== undefined &&
    (typeof lookbackDays !== 'number' ||
      !Number.isFinite(lookbackDays) ||
      lookbackDays <= 0)
  )
    return { error: 'config.lookbackDays must be a positive number' };
  const pattern = raw['subjectPattern'];
  let subject: RegExp | undefined;
  if (pattern !== undefined) {
    if (typeof pattern !== 'string')
      return { error: 'config.subjectPattern must be a string' };
    try {
      subject = new RegExp(pattern, 'iu');
    } catch {
      return { error: `config.subjectPattern is not a valid RegExp` };
    }
  }
  return {
    config: {
      from: from as string[],
      ...(lookbackDays === undefined ? {} : { lookbackDays }),
      ...(pattern === undefined ? {} : { subjectPattern: pattern as string }),
    },
    subject,
  };
}

const FOOTER_LINE =
  /unsubscribe|manage\s+(?:your\s+)?(?:subscriptions?|preferences)|update\s+(?:your\s+)?(?:subscriptions?|preferences)|you\s+(?:are\s+)?receiv(?:ed|ing)\s+this\b/iu;

/**
 * Drops list-mail boilerplate: everything after a "-- " signature delimiter,
 * and from the first unsubscribe / manage-your-subscription line onward
 * (with any rule line directly above it).
 */
export function stripEmailFooter(text: string): string {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  let end = lines.findIndex((line) => /^--\s?$/u.test(line));
  if (end < 0) end = lines.length;
  const footer = lines
    .slice(0, end)
    .findIndex((line) => FOOTER_LINE.test(line));
  if (footer >= 0) end = footer;
  while (end > 0 && /^[\s\-_=*#]*$/u.test(lines[end - 1] ?? '')) end -= 1;
  return lines
    .slice(0, end)
    .join('\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function oneLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim();
}

function messageUrl(message: MailMessage): string {
  return `email:${encodeURIComponent(message.id)}`;
}

function isPdf(attachment: MailMessage['attachments'][number]): boolean {
  return (
    /^application\/pdf\b/iu.test(attachment.contentType) ||
    /\.pdf$/iu.test(attachment.filename)
  );
}

function failure(
  source: SourceConfig,
  message: string,
  now: Date
): FetchResult[] {
  return [
    {
      kind: 'failed',
      status: null,
      url: source.url,
      requestUrl: source.url,
      contentType: 'text/plain',
      fetchedAt: now.toISOString(),
      error: { kind: 'network', message, retryable: false },
    },
  ];
}

/**
 * Email adapter, for towns that publish by mailing list. Source config:
 * { from: string[]; lookbackDays?: number; subjectPattern?: string }.
 * Each message becomes a text record (header block, blank line, body); each PDF
 * attachment becomes a blob-ref record keyed `email:<id>/<filename>` that
 * carries the message's subject and date as query parameters, because parse sees
 * only the record. Not HTTP: the mailbox is injected, `ctx.httpClient` unused.
 */
export function createEmailAdapter(
  mailbox: Mailbox,
  options: { now?: () => Date } = {}
): SourceAdapter {
  const now = options.now ?? (() => new Date());
  return {
    name: 'email',

    async fetch(
      source: SourceConfig,
      ctx: FetchContext
    ): Promise<FetchResult[]> {
      const clock = now();
      const parsed = parseEmailConfig(source);
      if ('error' in parsed) return failure(source, parsed.error, clock);
      const { config, subject } = parsed;
      const since = new Date(
        clock.getTime() -
          (config.lookbackDays ?? DEFAULT_LOOKBACK_DAYS) * DAY_MS
      );
      let messages: MailMessage[];
      try {
        messages = await mailbox.messagesSince(since, { from: config.from });
      } catch (error) {
        return failure(
          source,
          `mailbox read failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
          clock
        );
      }
      const fetchedAt = clock.toISOString();
      const out: FetchResult[] = [];
      for (const message of messages) {
        if (new Date(message.date) < since) continue;
        if (!senderMatches(message.from, config.from)) continue;
        if (subject && !subject.test(message.subject)) continue;
        const url = messageUrl(message);
        const header = [
          `Subject: ${oneLine(message.subject)}`,
          `From: ${message.from}`,
          `Date: ${message.date}`,
        ].join('\n');
        out.push({
          kind: 'fetched',
          status: 200,
          url,
          requestUrl: source.url,
          contentType: 'text/plain',
          payload: { kind: 'text', body: `${header}\n\n${message.text}` },
          fetchedAt,
          observedDates: [message.date],
        });
        if (!ctx.blobStore) continue;
        for (const attachment of message.attachments.filter(isPdf)) {
          const ref = await ctx.blobStore.put(
            attachment.content,
            'application/pdf'
          );
          const context = new URLSearchParams({
            subject: oneLine(message.subject),
            date: message.date,
          });
          out.push({
            kind: 'fetched',
            status: 200,
            url: `${url}/${encodeURIComponent(attachment.filename)}?${context}`,
            requestUrl: source.url,
            contentType: 'application/pdf',
            payload: { kind: 'blob-ref', ref },
            fetchedAt,
            observedDates: [message.date],
          });
        }
      }
      return out;
    },

    async parse(
      raw: RawDocumentInput,
      source: SourceConfig,
      ctx?: ParseContext
    ): Promise<DraftItem[]> {
      if (raw.payload.kind === 'blob-ref') {
        if (!ctx?.blobStore) return [];
        return parsePdf(raw, source, ctx);
      }
      return parseText(raw, source);
    },
  };
}

function parseText(raw: RawDocumentInput, source: SourceConfig): DraftItem[] {
  if (raw.payload.kind !== 'text') return [];
  const split = raw.payload.body.replace(/\r\n?/gu, '\n').split('\n\n');
  const header = new Map<string, string>();
  for (const line of (split.shift() ?? '').split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0)
      header.set(
        line.slice(0, colon).toLowerCase(),
        line.slice(colon + 1).trim()
      );
  }
  const body = stripEmailFooter(split.join('\n\n'));
  const title = header.get('subject') ?? '';
  if (!title && !body) return [];
  const date = header.get('date');
  const published = date && !Number.isNaN(Date.parse(date)) ? date : undefined;
  return [
    {
      title: title || 'Email',
      body,
      kind: source.kind,
      ...(published ? { publishedAt: new Date(published).toISOString() } : {}),
      uris: [senderLink(body, header.get('from') ?? '') ?? raw.url],
    },
  ];
}

/** The first http(s) link in the body that is on the sender's own domain. */
function senderLink(body: string, from: string): string | undefined {
  const domain = from.slice(from.lastIndexOf('@') + 1).toLowerCase();
  if (!domain) return undefined;
  for (const match of body.matchAll(/https?:\/\/[^\s<>"')\]]+/giu)) {
    const candidate = match[0].replace(/[.,;:!?]+$/u, '');
    try {
      if (new URL(candidate).hostname.toLowerCase() === domain)
        return candidate;
    } catch {
      // Not a URL after all; keep looking.
    }
  }
  return undefined;
}

async function parsePdf(
  raw: RawDocumentInput,
  source: SourceConfig,
  ctx: ParseContext
): Promise<DraftItem[]> {
  if (raw.payload.kind !== 'blob-ref' || !ctx.blobStore) return [];
  const bytes = await ctx.blobStore.get(raw.payload.ref);
  const text = await extractPdfText(bytes);
  if (!text) return [];
  const [path = '', query = ''] = raw.url.split('?');
  const context = new URLSearchParams(query);
  const encodedName = path.slice(path.indexOf('/') + 1);
  let filename = encodedName;
  try {
    filename = decodeURIComponent(encodedName);
  } catch {
    // Keep the raw name.
  }
  const subject = context.get('subject');
  const published = context.get('date') ?? undefined;
  const eventDate =
    meetingDateFromTitle(filename) ??
    meetingDateFromDocumentText(text) ??
    undefined;
  return [
    {
      title: subject ? `${filename} — ${subject}` : filename,
      body: text.slice(0, BODY_CHAR_CAP),
      kind: source.kind,
      ...(published ? { publishedAt: published } : {}),
      eventDate,
      uris: [raw.url],
    },
  ];
}
