import { CivicBriefingCommands } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';
import { CorpusService, DEFAULT_TOPIC } from './corpus.service';

const ARTICLE =
  'The Tifton City Council voted Monday night to hold the property tax millage rate at its current level for the coming fiscal year, ' +
  'after a public hearing in which several residents asked the council to consider relief for owners of older homes on fixed incomes. ' +
  'The city manager told the council the rate would pay for two additional firefighter positions and the resurfacing of several streets ' +
  'in the downtown district, work that has been delayed twice for lack of funds.';

const doc = {
  id: 'gazette:1',
  publisher: 'Tifton Gazette',
  title: 'Council holds millage rate',
  body: ARTICLE,
  url: null,
};

interface Sent {
  cmd: string;
  payload: unknown;
}

function client(reply: (cmd: string) => unknown) {
  const sent: Sent[] = [];
  return {
    sent,
    send: jest.fn((pattern: { cmd: string }, payload: unknown) => {
      sent.push({ cmd: pattern.cmd, payload });
      const value = reply(pattern.cmd);
      return value instanceof Error ? throwError(() => value) : of(value);
    }),
  };
}

describe('CorpusService', () => {
  it('is not available until a refresh from civic-briefing has succeeded', async () => {
    const briefing = client(() => new Error('connection refused'));
    const corpus = new CorpusService(briefing as never);
    expect(corpus.available).toBe(false);
    await corpus.onModuleInit();
    expect(corpus.available).toBe(false);
    expect(corpus.indexed).toBe(0);
    await corpus.onApplicationShutdown();
  });

  it('builds the copying index from the news the briefing service returns', async () => {
    const briefing = client(() => [doc]);
    const corpus = new CorpusService(briefing as never);
    await corpus.refresh();
    expect(briefing.sent[0]?.cmd).toBe(CivicBriefingCommands.CORPUS_NEWS);
    expect(corpus.available).toBe(true);
    expect(corpus.indexed).toBe(1);
    expect(corpus.check(ARTICLE)?.document.publisher).toBe('Tifton Gazette');
  });

  it('keeps the previous index when a refresh fails, and reports itself unavailable', async () => {
    let failing = false;
    const briefing = client(() => (failing ? new Error('timeout') : [doc]));
    const corpus = new CorpusService(briefing as never);
    await corpus.refresh();
    failing = true;
    await corpus.refresh();
    expect(corpus.available).toBe(false);
    expect(corpus.indexed).toBe(1);
    expect(corpus.check(ARTICLE)).not.toBeNull();
    failing = false;
    await corpus.refresh();
    expect(corpus.available).toBe(true);
  });

  it('asks the briefing service for subjects, topics and records, and keeps the answers', async () => {
    const subjects = [
      { kind: 'meeting', ref: '2', title: 'Agenda', date: null, url: null },
    ];
    const records = [
      {
        kind: 'record',
        ref: 'civic:2',
        title: 'Agenda',
        excerpt: 'x',
        date: '2026-09-15',
        url: null,
        publisher: 'Town',
      },
    ];
    const briefing = client((cmd) =>
      cmd === CivicBriefingCommands.SUBJECTS
        ? subjects
        : cmd === CivicBriefingCommands.TOPIC_FOR
        ? 'local-reporting'
        : records
    );
    const corpus = new CorpusService(briefing as never);

    expect(await corpus.subjects('town-ga')).toEqual(subjects);
    expect(await corpus.subjectExists('town-ga', 'meeting', '2')).toBe(true);
    expect(await corpus.subjectExists('town-ga', 'story', '2')).toBe(false);
    expect(await corpus.topicFor('town-ga', { kind: 'story', ref: '7' })).toBe(
      'local-reporting'
    );
    expect(await corpus.recordsSince('town-ga', '2026-09-14', 50)).toEqual(
      records
    );
    expect(briefing.sent.map((entry) => entry.cmd)).toEqual([
      CivicBriefingCommands.SUBJECTS,
      CivicBriefingCommands.SUBJECTS,
      CivicBriefingCommands.SUBJECTS,
      CivicBriefingCommands.TOPIC_FOR,
      CivicBriefingCommands.RECORDS_SINCE,
    ]);
    expect(briefing.sent[3]?.payload).toEqual({
      localitySlug: 'town-ga',
      subject: { kind: 'story', ref: '7' },
    });
    expect(briefing.sent[4]?.payload).toEqual({
      localitySlug: 'town-ga',
      day: '2026-09-14',
      limit: 50,
    });
  });

  it('falls back to government when the briefing service names no desk', async () => {
    const corpus = new CorpusService(client(() => null) as never);
    expect(await corpus.topicFor('town-ga', { kind: 'other', ref: null })).toBe(
      DEFAULT_TOPIC
    );
  });

  it('lets a failed question reach the caller rather than answering as if nothing were there', async () => {
    const corpus = new CorpusService(
      client(() => new Error('connection refused')) as never
    );
    await expect(corpus.subjects('town-ga')).rejects.toThrow(
      /connection refused/u
    );
    await expect(corpus.recordsSince('town-ga', '2026-09-14')).rejects.toThrow(
      /connection refused/u
    );
  });
});
