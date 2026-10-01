import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendCorpusRecording,
  createRecordingHttpClient,
  createReplayHttpClient,
  readCorpusIndex,
  readCorpusManifest,
} from '../src/corpus.js';
import { OutboundPolicyError } from '../src/outbound-policy.js';
import type { HttpClient, HttpResponse } from '../src/types.js';

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
function response(
  body: string | Uint8Array,
  init: {
    status?: number;
    type?: string;
    finalUrl: string;
    redirectChain?: string[];
  }
): HttpResponse {
  return Object.assign(
    new Response(
      typeof body === 'string' ? body : (body.slice().buffer as ArrayBuffer),
      {
        status: init.status ?? 200,
        headers: { 'content-type': init.type ?? 'text/html' },
      }
    ),
    {
      finalUrl: init.finalUrl,
      redirectChain: init.redirectChain ?? [init.finalUrl],
    }
  ) as HttpResponse;
}

function withCorpus(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(join(tmpdir(), 'civic-corpus-'));
  return run(directory).finally(() =>
    rmSync(directory, { recursive: true, force: true })
  );
}

describe('source corpus', () => {
  it('records responses once per session and replays them without the network', () =>
    withCorpus(async (directory) => {
      const calls: string[] = [];
      const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
      const live: HttpClient = {
        async fetch(url) {
          calls.push(url);
          if (url.endsWith('/feed'))
            return response('<rss>feed</rss>', {
              type: 'application/rss+xml',
              finalUrl: url,
            });
          if (url.endsWith('/agenda.pdf'))
            return response(pdf, {
              type: 'application/pdf',
              finalUrl: `${url}?v=2`,
              redirectChain: [url, `${url}?v=2`],
            });
          if (url.includes('restricted'))
            throw new OutboundPolicyError('https://restricted.example/story');
          throw new Error('connect ECONNREFUSED');
        },
      };
      const recorder = createRecordingHttpClient(
        live,
        directory,
        '2026-09-16T12:00:00.000Z'
      );
      expect(
        await (await recorder.fetch('https://city.example/feed')).text()
      ).toBe('<rss>feed</rss>');
      expect(
        await (await recorder.fetch('https://city.example/feed')).text()
      ).toBe('<rss>feed</rss>');
      await recorder.fetch('https://city.example/agenda.pdf');
      await expect(
        (() => recorder.fetch('https://down.example/'))()
      ).rejects.toThrow(/ECONNREFUSED/);
      await expect(
        (() => recorder.fetch('https://news.example/restricted'))()
      ).rejects.toThrow(OutboundPolicyError);
      appendCorpusRecording(directory, '2026-09-16T12:00:00.000Z', ['town-a']);
      expect(calls).toStrictEqual([
        'https://city.example/feed',
        'https://city.example/agenda.pdf',
        'https://down.example/',
        'https://news.example/restricted',
      ]);
      expect(readCorpusIndex(directory).length).toBe(4);
      expect(readdirSync(join(directory, 'bodies')).length).toBe(2);
      expect(readCorpusManifest(directory).recordings).toStrictEqual([
        { recordedAt: '2026-09-16T12:00:00.000Z', localities: ['town-a'] },
      ]);

      const replay = createReplayHttpClient(directory);
      const feed = await replay.fetch('https://city.example/feed');
      expect(feed.headers.get('content-type')).toBe('application/rss+xml');
      expect(await feed.text()).toBe('<rss>feed</rss>');
      const agenda = await replay.fetch('https://city.example/agenda.pdf');
      expect(new Uint8Array(await agenda.arrayBuffer())).toStrictEqual(pdf);
      expect(agenda.finalUrl).toBe('https://city.example/agenda.pdf?v=2');
      expect(agenda.redirectChain).toStrictEqual([
        'https://city.example/agenda.pdf',
        'https://city.example/agenda.pdf?v=2',
      ]);
      await expect(
        (() => replay.fetch('https://down.example/'))()
      ).rejects.toThrow(/ECONNREFUSED/);
      await expect(
        ((error: unknown) =>
          error instanceof OutboundPolicyError &&
          error.url === 'https://restricted.example/story')(
          await captureRejection(() =>
            replay.fetch('https://news.example/restricted')
          )
        )
      ).toBe(true);
      await expect(
        (() => replay.fetch('https://never.example/'))()
      ).rejects.toThrow(/not in corpus/);
      expect(replay.misses).toStrictEqual(['https://never.example/']);
      expect(
        (await replay.validate!('https://city.example/other.pdf')).hostname
      ).toBe('city.example');
    }));

  it('serves the latest recording at or before the replay date', () =>
    withCorpus(async (directory) => {
      let version = 'first';
      const live: HttpClient = {
        fetch: async (url) => response(version, { finalUrl: url }),
      };
      await createRecordingHttpClient(
        live,
        directory,
        '2026-09-01T12:00:00.000Z'
      ).fetch('https://city.example/feed');
      version = 'second';
      await createRecordingHttpClient(
        live,
        directory,
        '2026-09-10T12:00:00.000Z'
      ).fetch('https://city.example/feed');
      const at = (iso: string) =>
        createReplayHttpClient(directory, { asOf: () => new Date(iso) });
      expect(
        await (
          await at('2026-08-20T00:00:00.000Z').fetch(
            'https://city.example/feed'
          )
        ).text()
      ).toBe('first');
      expect(
        await (
          await at('2026-09-05T00:00:00.000Z').fetch(
            'https://city.example/feed'
          )
        ).text()
      ).toBe('first');
      expect(
        await (
          await at('2026-09-12T00:00:00.000Z').fetch(
            'https://city.example/feed'
          )
        ).text()
      ).toBe('second');
      expect(
        await (
          await createReplayHttpClient(directory).fetch(
            'https://city.example/feed'
          )
        ).text()
      ).toBe('second');
      version = 'first-day re-record';
      await createRecordingHttpClient(
        live,
        directory,
        '2026-09-01T18:00:00.000Z'
      ).fetch('https://city.example/feed');
      expect(
        await (
          await at('2026-08-20T00:00:00.000Z').fetch(
            'https://city.example/feed'
          )
        ).text()
      ).toBe('first-day re-record');
    }));

  it('applies the caller restricted-domain policy to replayed final URLs', () =>
    withCorpus(async (directory) => {
      const live: HttpClient = {
        fetch: async (url) =>
          response('article', {
            finalUrl: 'https://www.paper.example/story/1',
            redirectChain: [url, 'https://www.paper.example/story/1'],
          }),
      };
      await createRecordingHttpClient(live, directory).fetch(
        'https://news.example/item'
      );
      const replay = createReplayHttpClient(directory);
      expect(
        await (await replay.fetch('https://news.example/item')).text()
      ).toBe('article');
      await expect(
        (() =>
          replay.fetch('https://news.example/item', {
            policy: { deniedRegistrableDomains: ['paper.example'] },
          }))()
      ).rejects.toThrow(OutboundPolicyError);
    }));
});
