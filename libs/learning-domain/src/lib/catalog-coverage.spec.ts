import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tutorialProgramTracks } from './tutorial-catalog';
import { tutorialExercises } from './tutorial-content';
import { LessonMetadata } from './learning-domain';

/**
 * The catalog and the content on disk have to agree.
 *
 * Counting these by hand got the answer wrong twice, in both directions, so
 * the check lives here now. A lesson file nobody can reach is wasted writing;
 * a catalog entry pointing at nothing is a broken page.
 */

const CONTENT_ROOT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'apps',
  'learning-service',
  'src',
  'assets',
  'content'
);

const REPOSITORY_FOR: Record<string, string> = {
  typescript: 'letsgots',
  go: 'letsgogo',
  cpp: 'letsgocpp',
  rust: 'letsgorust',
};

function markdownUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return markdownUnder(path);
    return path.endsWith('.md') ? [path] : [];
  });
}

function lessonsOf(track: (typeof tutorialProgramTracks)[number]) {
  return track.offerings
    .flatMap((offering) => offering.modules)
    .flatMap((module) => module.lessons);
}

function fileFor(repository: string, lesson: LessonMetadata): string {
  const relative = lesson.languageVariants[0].sourcePath.replace(
    /^src\/content\//,
    ''
  );
  return join(CONTENT_ROOT, repository, relative);
}

describe('curriculum catalog coverage', () => {
  const tracks = tutorialProgramTracks.map((track) => {
    const language = track.supportedLanguageIds[0];
    return {
      track,
      language,
      repository: REPOSITORY_FOR[language],
      lessons: lessonsOf(track),
    };
  });

  it('covers all four language tracks', () => {
    expect(tracks.map((entry) => entry.language).sort()).toEqual([
      'cpp',
      'go',
      'rust',
      'typescript',
    ]);
  });

  describe.each(tracks)('$repository', ({ repository, lessons }) => {
    it('points every lesson at a file that exists', () => {
      const broken = lessons
        .filter((lesson) => !existsSync(fileFor(repository, lesson)))
        .map(
          (lesson) => `${lesson.id} -> ${lesson.languageVariants[0].sourcePath}`
        );

      expect(broken).toEqual([]);
    });

    it('leaves no lesson file unreachable', () => {
      const referenced = new Set(
        lessons.map((lesson) => fileFor(repository, lesson))
      );
      const orphaned = markdownUnder(join(CONTENT_ROOT, repository))
        .filter((file) => !referenced.has(file))
        .map((file) => file.replace(join(CONTENT_ROOT, repository) + '/', ''));

      expect(orphaned).toEqual([]);
    });

    it('gives every lesson a unique id', () => {
      const ids = lessons.map((lesson) => lesson.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  it('matches the content actually shipped, per track', () => {
    const counts = Object.fromEntries(
      tracks.map(({ repository, lessons }) => [repository, lessons.length])
    );

    // Update these when lessons are genuinely added, not to silence a failure.
    expect(counts).toEqual({
      letsgots: 38,
      letsgogo: 47,
      letsgocpp: 23,
      letsgorust: 24,
    });
  });

  describe('sub-lessons', () => {
    const allLessons = tracks.flatMap((entry) => entry.lessons);
    const withParents = allLessons.filter((lesson) => lesson.parentLessonId);

    it('breaks down four of Go basics topics', () => {
      expect(withParents).toHaveLength(12);
      const parents = new Set(
        withParents.map((lesson) => lesson.parentLessonId)
      );
      expect(parents.size).toBe(4);
    });

    it('names a parent that is itself a real lesson', () => {
      const ids = new Set(allLessons.map((lesson) => lesson.id));
      const dangling = withParents
        .map((lesson) => lesson.parentLessonId)
        .filter((parentId) => !ids.has(parentId as string));

      expect(dangling).toEqual([]);
    });

    it('never makes a lesson its own parent', () => {
      const selfReferencing = withParents.filter(
        (lesson) => lesson.parentLessonId === lesson.id
      );
      expect(selfReferencing).toEqual([]);
    });
  });

  // An exercise whose lessonSlug matches no lesson is invisible: nothing
  // renders it and no learner can reach it. Found by opening the Go
  // hello-world lesson and seeing an empty practice pane.
  describe('exercise reachability', () => {
    const reachability = tracks.map(({ language, lessons }) => {
      const slugs = new Set(lessons.map((lesson) => lesson.slug));
      const exercises = tutorialExercises.filter(
        (exercise) => exercise.languageId === language
      );
      return {
        language,
        total: exercises.length,
        orphans: exercises
          .filter((exercise) => !slugs.has(exercise.lessonSlug))
          .map((exercise) => exercise.lessonSlug),
      };
    });

    it.each(reachability.filter((entry) => entry.language !== 'go'))(
      'attaches every $language exercise to a lesson',
      ({ orphans }) => {
        expect([...new Set(orphans)]).toEqual([]);
      }
    );

    // Go still has seven, and they are a content gap rather than a mapping
    // bug: each names a sub-topic that upstream taught inside another lesson
    // and that has no markdown file here. Pinned so the number cannot grow
    // quietly; shrink it by adding the lessons, not by editing this list.
    it('has exactly the known Go exercises with nowhere to live', () => {
      const go = reachability.find((entry) => entry.language === 'go');

      expect([...new Set(go?.orphans)].sort()).toEqual([
        'basic-select',
        'benchmark-basics',
        'context-basics',
        'defer-statements',
        'error-values',
        'middleware-pattern',
        'waitgroup-basics',
      ]);
    });
  });
});
