import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  builtInProgramTracks,
  tutorialProgramTracks,
} from './tutorial-catalog';
import { techLiteracyTrack } from './tech-literacy';
import { programmingConceptsTrack } from './programming-concepts';
import { systemsDesignTrack } from './systems-design';
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
      letsgocpp: 24,
      letsgorust: 25,
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

/**
 * The courses written here rather than ported.
 *
 * Held to the same promise as the four above: no catalog entry without a file,
 * and no file without a catalog entry. Kept in its own block because the
 * checks above are about agreement with four upstream repositories, which this
 * course has nothing to do with.
 */
describe.each([
  ['Tech Literacy', techLiteracyTrack],
  ['Programming Concepts', programmingConceptsTrack],
  ['Systems Design', systemsDesignTrack],
])('courses written in this workspace: %s', (_name, track) => {
  const lessonsOfTrack = lessonsOf(track);

  it('is in the catalog the platform actually serves', () => {
    expect(builtInProgramTracks).toContain(track);
    // And is not mistaken for one of the ported four.
    expect(tutorialProgramTracks).not.toContain(track);
  });

  it('claims no language, because it teaches no single one', () => {
    // Both of these courses are deliberately language-free: one has no code
    // in it at all, the other is the spine the four language courses hang
    // from. Claiming a language would file either under the wrong filter.
    expect(track.supportedLanguageIds).toBeUndefined();
    expect(track.variantAxis).toBeUndefined();
  });

  it('points every lesson at a file that exists', () => {
    const repository = track.contentCollection ?? '';
    const broken = lessonsOfTrack
      .filter((lesson) => !existsSync(fileFor(repository, lesson)))
      .map(
        (lesson) => `${lesson.id} -> ${selectLessonContent(lesson).sourcePath}`
      );

    expect(broken).toEqual([]);
  });

  it('leaves no lesson file unreachable', () => {
    const repository = track.contentCollection ?? '';
    const referenced = new Set(
      lessonsOfTrack.map((lesson) => fileFor(repository, lesson))
    );
    const orphaned = markdownUnder(join(CONTENT_ROOT, repository))
      .filter((file) => !referenced.has(file))
      .map((file) => file.replace(join(CONTENT_ROOT, repository) + '/', ''));

    expect(orphaned).toEqual([]);
  });

  it('attaches every activity to a lesson that exists', () => {
    // An activity naming a lesson that is not there is work nobody can reach,
    // which is the same defect the exercise reachability check above exists
    // to catch.
    const lessonIds = new Set(lessonsOfTrack.map((lesson) => lesson.id));
    const orphaned = track.offerings
      .flatMap((offering) => offering.activities)
      .filter(
        (activity) => activity.lessonId && !lessonIds.has(activity.lessonId)
      )
      .map((activity) => `${activity.id} -> ${activity.lessonId}`);

    expect(orphaned).toEqual([]);
  });

  it('sets work that does not need the code runner', () => {
    const types = new Set(
      track.offerings
        .flatMap((offering) => offering.activities)
        .map((activity) => activity.type)
    );

    expect(types.has('code.run')).toBe(false);
    // And genuinely uses the author-facing types, since exercising those is
    // half the reason these courses exist.
    expect(types.has('writing.response')).toBe(true);
    expect(types.has('quiz.mcq')).toBe(true);
    expect(types.has('project.submission')).toBe(true);
  });

  it('gives every written activity a rubric to be marked against', () => {
    // Without one the answer is recorded and left for a person, which is a
    // real fallback but not what these courses intend.
    const unmarkable = track.offerings
      .flatMap((offering) => offering.activities)
      .filter(
        (activity) => activity.type === 'writing.response' && !activity.rubric
      )
      .map((activity) => activity.id);

    expect(unmarkable).toEqual([]);
  });
});

describe('what each workspace-written course is for', () => {
  it('gives Tech Literacy a subject that is not programming', () => {
    // The whole reason that course exists. A platform claiming to teach any
    // subject, whose entire catalog is programming, is making a claim a
    // visitor can disprove at a glance.
    expect(techLiteracyTrack.subjectIds).not.toContain('programming');
  });

  it('files Programming Concepts under programming without tying it to one', () => {
    // The opposite case: it belongs with the language courses in the catalog,
    // and would be miscategorised anywhere else, but a learner arriving from
    // any of the four should find it.
    expect(programmingConceptsTrack.subjectIds).toContain('programming');
  });

  it('gives each of these courses its own content collection', () => {
    // Sharing one would make the unreachable-file check above vacuous, since
    // every orphan in one course would be claimed by another.
    const collections = [
      techLiteracyTrack,
      programmingConceptsTrack,
      systemsDesignTrack,
    ].map((track) => track.contentCollection);

    expect(collections.every(Boolean)).toBe(true);
    expect(new Set(collections).size).toBe(collections.length);
  });

  it('stacks the two programming courses rather than duplicating a level', () => {
    // Programming Concepts is the spine under the four language courses;
    // Systems Design sits above it and assumes the code already works. Giving
    // them the same level would file them as alternatives to each other.
    const conceptsLevel = programmingConceptsTrack.offerings[0].level;
    const designLevel = systemsDesignTrack.offerings[0].level;

    expect(designLevel).toBeGreaterThan(conceptsLevel as number);
  });
});

/**
 * Adding a course must not remove one.
 *
 * This catalog has done exactly that before: listPrograms once treated a
 * non-empty table as a full replacement for the built-ins, so authoring a
 * single course emptied it. Every course added to the shipped set since is
 * asserted here rather than assumed, and the counts below are per ported
 * track so a loss cannot be masked by a gain elsewhere.
 */
describe('the catalog only ever grows', () => {
  it('still carries all four ported courses', () => {
    const ids = builtInProgramTracks.map((track) => track.id);

    expect(ids).toEqual(
      expect.arrayContaining([
        'typescript-foundations',
        'go-foundations',
        'cpp-foundations',
        'rust-foundations',
      ])
    );
  });

  it('carries the new courses alongside them, not instead of them', () => {
    expect(builtInProgramTracks).toHaveLength(tutorialProgramTracks.length + 3);
    expect(builtInProgramTracks.map((track) => track.id)).toEqual(
      expect.arrayContaining([
        'tech-literacy',
        'programming-concepts',
        'systems-design',
      ])
    );
  });

  it('leaves the ported courses' + ' lessons untouched', () => {
    // Counted per track rather than in total, so a course losing lessons
    // cannot be hidden by another course gaining them.
    const counts = Object.fromEntries(
      tutorialProgramTracks.map((track) => [track.id, lessonsOf(track).length])
    );

    expect(counts).toEqual({
      'typescript-foundations': 38,
      'go-foundations': 49,
      'cpp-foundations': 24,
      'rust-foundations': 25,
    });
  });

  it('gives every track a distinct id', () => {
    const ids = builtInProgramTracks.map((track) => track.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * A table whose rows disagree about how many columns they have.
 *
 * This is invisible until somebody opens the page. A pipe inside a code span
 * has to be escaped as `\|`, and one that is not silently becomes a column
 * break: the header grows a phantom column, every body row is short by one,
 * and the reader gets a garbled table. It shipped that way in the TypeScript
 * course's union-and-intersection lesson, where the heading `A | B` split
 * itself in half, and a formatter then reflowed the file around the break so
 * it looked deliberate.
 *
 * Nothing else catches this. The markdown is valid, the build is clean, and
 * the coverage checks above only care that files exist.
 */
describe('markdown tables in the courseware', () => {
  /** Cells in a table row, where an escaped pipe is content and not a border. */
  function cellCount(row: string): number {
    return row
      .trim()
      .replace(/^\||\|$/g, '')
      .split(/(?<!\\)\|/).length;
  }

  const malformed = builtInProgramTracks
    .flatMap((track) =>
      markdownUnder(join(CONTENT_ROOT, track.contentCollection ?? ''))
    )
    .flatMap((file) => {
      const lines = readFileSync(file, 'utf8').split('\n');
      const problems: string[] = [];
      let inFence = false;
      lines.forEach((line, index) => {
        if (line.startsWith('```')) {
          inFence = !inFence;
          return;
        }
        // The separator row is what makes the lines around it a table.
        if (inFence || !/^\s*\|[\s:|-]+\|\s*$/.test(line)) return;
        const header = lines[index - 1];
        if (!header?.trim().startsWith('|')) return;

        const width = cellCount(header);
        if (cellCount(line) !== width) {
          problems.push(`${file}:${index + 1} separator width`);
        }
        for (let row = index + 1; row < lines.length; row++) {
          if (!lines[row].trim().startsWith('|')) break;
          if (cellCount(lines[row]) !== width) {
            problems.push(
              `${file}:${row + 1} has ${cellCount(
                lines[row]
              )} cells, header has ${width}`
            );
          }
        }
      });
      return problems;
    });

  it('gives every row the same number of columns as its header', () => {
    expect(malformed).toEqual([]);
  });
});
