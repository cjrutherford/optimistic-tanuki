import {
  ALL_LLM_TASKS,
  describeTaskModel,
  resolveTaskModel,
} from './task-models';

/**
 * The split is a measured tradeoff, not a preference: granite is faster on
 * every call and needs no priming, but qwen is the only candidate whose
 * interview questions build on the answer just given.
 */
describe('task model routing', () => {
  const config = {
    primary: 'granite4:tiny-h',
    conversational: 'qwen3.5:4b-q8_0',
  };

  it('runs extraction work on the primary', () => {
    for (const task of ['resume-parse', 'mad-lib', 'topic-analysis'] as const) {
      expect(resolveTaskModel(task, config)).toBe('granite4:tiny-h');
    }
  });

  it('runs the interview turns on the conversational model', () => {
    for (const task of ['disc-question', 'disc-assessment'] as const) {
      expect(resolveTaskModel(task, config)).toBe('qwen3.5:4b-q8_0');
    }
  });

  it('falls back to the primary when no conversational model is set', () => {
    // A single-model deployment must keep working with no extra configuration.
    const single = { primary: 'granite4:tiny-h' };

    for (const task of ALL_LLM_TASKS) {
      expect(resolveTaskModel(task, single)).toBe('granite4:tiny-h');
    }
  });

  it('lets a per-task override beat both', () => {
    const pinned = { ...config, overrides: { 'disc-question': 'qwen3:8b' } };

    expect(resolveTaskModel('disc-question', pinned)).toBe('qwen3:8b');
    // ...without disturbing its sibling.
    expect(resolveTaskModel('disc-assessment', pinned)).toBe('qwen3.5:4b-q8_0');
  });

  it('says why each task resolved as it did', () => {
    expect(describeTaskModel('resume-parse', config)).toContain('primary');
    expect(describeTaskModel('disc-question', config)).toContain(
      'conversational'
    );
    expect(
      describeTaskModel('disc-question', {
        ...config,
        overrides: { 'disc-question': 'qwen3:8b' },
      })
    ).toContain('override');
  });
});
