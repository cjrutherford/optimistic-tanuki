import { LessonMetadata, rollUpCompletedLessons } from './learning-domain';

const variant = [
  { variantId: 'go', format: 'file-variant' as const, sourcePath: 'x.md' },
];

function lesson(id: string, parentLessonId?: string): LessonMetadata {
  return {
    id,
    title: id,
    slug: id,
    content: variant,
    ...(parentLessonId ? { parentLessonId } : {}),
  };
}

const overview = lesson('variables-types');
const partA = lesson('basic-types', 'variables-types');
const partB = lesson('type-conversion', 'variables-types');
const partC = lesson('custom-types', 'variables-types');
const unrelated = lesson('hello-world');
const all = [overview, partA, partB, partC, unrelated];

describe('rollUpCompletedLessons', () => {
  it('leaves the overview open while parts are outstanding', () => {
    const completed = rollUpCompletedLessons(all, ['basic-types']);

    expect(completed.has('variables-types')).toBe(false);
    expect(completed.has('basic-types')).toBe(true);
  });

  it('still leaves it open when only one part remains', () => {
    const completed = rollUpCompletedLessons(all, [
      'basic-types',
      'type-conversion',
    ]);

    expect(completed.has('variables-types')).toBe(false);
  });

  // The point of the whole thing: finish the parts, and the overview is done.
  it('closes the overview once every part is done', () => {
    const completed = rollUpCompletedLessons(all, [
      'basic-types',
      'type-conversion',
      'custom-types',
    ]);

    expect(completed.has('variables-types')).toBe(true);
  });

  it('keeps an overview the learner completed directly', () => {
    const completed = rollUpCompletedLessons(all, ['variables-types']);

    expect(completed.has('variables-types')).toBe(true);
  });

  it('leaves lessons with no parts alone', () => {
    const completed = rollUpCompletedLessons(all, ['hello-world']);

    expect([...completed]).toEqual(['hello-world']);
  });

  it('reports nothing done when nothing is done', () => {
    expect([...rollUpCompletedLessons(all, [])]).toEqual([]);
  });

  it('does not invent completions from an empty catalog', () => {
    expect([...rollUpCompletedLessons([], ['anything'])]).toEqual(['anything']);
  });

  it('handles several parents independently', () => {
    const lessons = [
      ...all,
      lesson('functions'),
      lesson('multiple-returns', 'functions'),
    ];
    const completed = rollUpCompletedLessons(lessons, [
      'basic-types',
      'type-conversion',
      'custom-types',
      // 'functions' has one part, and it is not done
    ]);

    expect(completed.has('variables-types')).toBe(true);
    expect(completed.has('functions')).toBe(false);
  });

  it('does not mutate what it was given', () => {
    const done = ['basic-types', 'type-conversion', 'custom-types'];
    rollUpCompletedLessons(all, done);

    expect(done).toEqual(['basic-types', 'type-conversion', 'custom-types']);
  });
});
