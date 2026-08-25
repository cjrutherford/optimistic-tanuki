import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tutorialProgramTracks } from './tutorial-catalog';
import { tutorialExercises } from './tutorial-content';
import { LessonMetadata, selectLessonContent } from './learning-domain';

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

/**
 * What each track's content folder is expected to be called.
 *
 * The catalog now carries this as `contentCollection` rather than deriving it
 * from a language, so this map exists only to check that what the catalog
 * derived is what is actually on disk.
 */
const COLLECTION_FOR: Record<string, string> = {
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
  // Every lesson in the four ported tracks is a file. A lesson that carried
  // its own text instead would have nothing to look for on disk, and silently
  // resolving to the content root would make this whole check meaningless.
  const { sourcePath } = selectLessonContent(lesson);
  if (!sourcePath) {
    throw new Error(`Lesson ${lesson.id} has no source path`);
  }
  const relative = sourcePath.replace(/^src\/content\//, '');
  return join(CONTENT_ROOT, repository, relative);
}

describe('curriculum catalog coverage', () => {
  const tracks = tutorialProgramTracks.map((track) => {
    const language = track.supportedLanguageIds?.[0] ?? '';
    return {
      track,
      language,
      repository: track.contentCollection ?? '',
      lessons: lessonsOf(track),
    };
  });

  it('names a content folder that matches the track it came from', () => {
    for (const entry of tracks) {
      expect(entry.repository).toBe(COLLECTION_FOR[entry.language]);
    }
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
          (lesson) =>
            `${lesson.id} -> ${selectLessonContent(lesson).sourcePath}`
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
      letsgogo: 49,
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

    // Go's seven were once pinned here as a content gap, on the reading that
    // each named a sub-topic with no markdown file. That was wrong. Every one
    // of them named a lesson that already existed under a different slug:
    // error-values was error-handling, defer-statements was
    // defer-panic-recover, basic-select was select-statement, and so on. They
    // were repointed, so no language gets an exception any more.
    it.each(reachability)(
      'attaches every $language exercise to a lesson',
      ({ orphans }) => {
        expect([...new Set(orphans)]).toEqual([]);
      }
    );

    it('practises every language it teaches', () => {
      const silent = reachability.filter((entry) => entry.total === 0);
      expect(silent).toEqual([]);
    });
  });
});
