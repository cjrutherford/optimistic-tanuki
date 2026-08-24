import { GradingService } from './grading.service';
import type { WritingResponseActivity } from '@optimistic-tanuki/learning-domain';

/**
 * The marking itself is pure and lives in learning-domain. What matters here
 * is that a grader which is unreachable, slow, or talking nonsense never
 * awards anything and never loses the learner's work.
 */
describe('GradingService', () => {
  const activity: WritingResponseActivity = {
    type: 'writing.response',
    id: 'w1',
    prompt: 'What is the range?',
    rubric: {
      id: 'r1',
      title: 'Reading a tide table',
      criteria: [
        { id: 'range', description: 'Explains the range.', maxPoints: 2 },
      ],
    },
  };

  const answer = 'The range is the difference between them, so 4.3 m.';

  function replyWith(content: unknown, ok = true) {
    return jest.fn(async () => ({
      ok,
      status: ok ? 200 : 503,
      json: async () => ({ message: { content } }),
    })) as unknown as typeof fetch;
  }

  let service: GradingService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = new GradingService();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.LEARNING_OLLAMA_URL;
    delete process.env.LEARNING_GRADING_MODEL;
  });

  it('marks an answer the model could point at', async () => {
    global.fetch = replyWith(
      JSON.stringify({
        criteria: [
          { id: 'range', points: 2, evidence: 'the difference', comment: '' },
        ],
        feedback: 'Good.',
      })
    );

    await expect(service.gradeWriting(activity, answer)).resolves.toMatchObject(
      { score: 2, maxScore: 2 }
    );
  });

  // The whole point of the evidence check, exercised through the service.
  it('awards nothing when the model quotes what is not there', async () => {
    global.fetch = replyWith(
      JSON.stringify({
        criteria: [
          { id: 'range', points: 2, evidence: 'nowhere near', comment: '' },
        ],
        feedback: 'Excellent.',
      })
    );

    const outcome = await service.gradeWriting(activity, answer);

    expect(outcome?.score).toBe(0);
  });

  it('marks nothing without a rubric to mark against', async () => {
    global.fetch = replyWith('{}');

    await expect(
      service.gradeWriting({ ...activity, rubric: undefined }, answer)
    ).resolves.toBeUndefined();
  });

  it('leaves an answer unmarked when the model is unreachable', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('connect ECONNREFUSED');
    }) as unknown as typeof fetch;

    await expect(
      service.gradeWriting(activity, answer)
    ).resolves.toBeUndefined();
  });

  it('leaves an answer unmarked when the model refuses', async () => {
    global.fetch = replyWith('', false);

    await expect(
      service.gradeWriting(activity, answer)
    ).resolves.toBeUndefined();
  });

  /**
   * Measured against the live model: about one call in three came back with
   * truncated JSON, which is common enough that a single failure should not
   * leave a learner unmarked.
   */
  it('tries once more when the model returns something unusable', async () => {
    const good = JSON.stringify({
      criteria: [
        { id: 'range', points: 2, evidence: 'the difference', comment: '' },
      ],
      feedback: 'Good.',
    });
    let call = 0;
    global.fetch = jest.fn(async () => {
      call += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          message: { content: call === 1 ? '{"criteria": [' : good },
        }),
      };
    }) as unknown as typeof fetch;

    const outcome = await service.gradeWriting(activity, answer);

    expect(call).toBe(2);
    expect(outcome?.score).toBe(2);
  });

  it('gives up after the second try rather than looping', async () => {
    const fetcher = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ message: { content: 'not json at all' } }),
    }));
    global.fetch = fetcher as unknown as typeof fetch;

    await expect(
      service.gradeWriting(activity, answer)
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('asks the host it was configured with', async () => {
    process.env.LEARNING_OLLAMA_URL = 'http://shangrila:11434';
    process.env.LEARNING_GRADING_MODEL = 'granite4:tiny-h';
    const fetcher = replyWith('{"criteria":[],"feedback":"x"}');
    global.fetch = fetcher;

    await service.gradeWriting(activity, answer);

    const [url, init] = (fetcher as unknown as jest.Mock).mock.calls[0];
    expect(url).toBe('http://shangrila:11434/api/chat');
    expect(JSON.parse(init.body).model).toBe('granite4:tiny-h');
  });

  // Two identical answers should be marked the same way.
  it('asks for the same marking every time', async () => {
    const fetcher = replyWith('{"criteria":[],"feedback":"x"}');
    global.fetch = fetcher;

    await service.gradeWriting(activity, answer);

    const body = JSON.parse(
      (fetcher as unknown as jest.Mock).mock.calls[0][1].body
    );
    expect(body.options.temperature).toBe(0);
    expect(body.format).toBeDefined();
  });
});
