import {
  LessonMetadataSchema,
  OfferingSchema,
  ProgramTrackSchema,
  RunnerProfileSchema,
  lessonHasVariant,
  selectLessonContent,
  calculateTotalCredits,
  evaluateRequirementGroup,
  isOfferingUnlocked,
  authorizeOfferingAction,
  buildDraftOffering,
  buildDraftProgramTrack,
  OfferingOwnership,
} from './learning-domain';
import {
  programmingBasicsProgramTrack,
  sampleProgramTrack,
} from './demo-programs';
import { tutorialProgramTracks } from './tutorial-catalog';

describe('learning-domain', () => {
  it('calculates credit totals from completed offerings', () => {
    const credits = calculateTotalCredits(sampleProgramTrack.offerings, [
      'systems-100-core',
      'systems-200-capstone-project',
    ]);

    expect(credits).toBe(7);
  });

  it('evaluates requirement group completion for n-of-m requirements', () => {
    const incomplete = evaluateRequirementGroup(
      sampleProgramTrack.requirements,
      ['systems-100-core']
    );
    const complete = evaluateRequirementGroup(sampleProgramTrack.requirements, [
      'systems-100-core',
      'systems-200-capstone-project',
    ]);

    expect(incomplete.satisfied).toBe(false);
    expect(complete.satisfied).toBe(true);
  });

  it('applies prerequisite and unlock rules before unlocking an offering', () => {
    const project = sampleProgramTrack.offerings.find(
      (offering) => offering.id === 'systems-200-capstone-project'
    );

    expect(project).toBeDefined();
    expect(isOfferingUnlocked(project!, [])).toBe(false);
    expect(isOfferingUnlocked(project!, ['systems-100-core'])).toBe(false);
    expect(
      isOfferingUnlocked(project!, [
        'systems-100-core',
        'systems-200-elective-testing',
      ])
    ).toBe(true);
  });

  it('validates sample program data against schema', () => {
    expect(() => ProgramTrackSchema.parse(sampleProgramTrack)).not.toThrow();
  });

  it('provides a multi-language programming basics course', () => {
    const course = programmingBasicsProgramTrack.offerings[0];

    expect(programmingBasicsProgramTrack.supportedLanguageIds).toEqual([
      'typescript',
      'go',
      'cpp',
      'rust',
    ]);
    expect(course.outcomeTags).toEqual(
      expect.arrayContaining([
        'functions',
        'scope',
        'execution-context',
        'runtimes',
        'garbage-collection',
        'memory-management',
        'algorithms',
      ])
    );
    expect(() =>
      ProgramTrackSchema.parse(programmingBasicsProgramTrack)
    ).not.toThrow();
  });

  it('provides single-language tutorial tracks with a locked-down runner profile', () => {
    expect(
      tutorialProgramTracks.map((track) => track.source?.repositoryUrl)
    ).toEqual([
      'https://github.com/cjrutherford/letsgots',
      'https://github.com/cjrutherford/letsgogo',
      'https://github.com/cjrutherford/letsgocpp',
      'https://github.com/cjrutherford/letsgorust',
    ]);

    for (const track of tutorialProgramTracks) {
      expect(track.source?.runner).toMatchObject({
        networkEnabled: false,
        readOnlyRootFilesystem: true,
        writableFilesystem: 'scratch-only',
      });
      expect(track.source?.runner.maxExecutionSeconds).toBeLessThanOrEqual(10);
      expect(track.source?.runner.maxMemoryMiB).toBeLessThanOrEqual(256);
      expect(track.source?.runner.maxProcesses).toBeLessThanOrEqual(32);
    }
  });

  it('rejects runner profiles that permit network access', () => {
    const profile = tutorialProgramTracks[0].source!.runner;

    expect(
      RunnerProfileSchema.safeParse({ ...profile, networkEnabled: true })
        .success
    ).toBe(false);
  });

  it('validates every tutorial track against the program schema', () => {
    for (const track of tutorialProgramTracks) {
      expect(() => ProgramTrackSchema.parse(track)).not.toThrow();
    }
  });

  it('migrates every language course module and lesson', () => {
    expect(
      tutorialProgramTracks.map((track) => ({
        id: track.id,
        modules: track.offerings[0].modules.length,
        lessons: track.offerings[0].modules.reduce(
          (total, module) => total + module.lessons.length,
          0
        ),
      }))
    ).toEqual([
      { id: 'typescript-foundations', modules: 12, lessons: 38 },
      { id: 'go-foundations', modules: 11, lessons: 47 },
      { id: 'cpp-foundations', modules: 7, lessons: 23 },
      // 24, not 23: error-handling/03-custom-errors.md shipped with the
      // content but had no catalog entry, so nobody could open it.
      { id: 'rust-foundations', modules: 9, lessons: 24 },
    ]);
  });

  it('places Rust lifetimes after traits and generics', () => {
    const rust = tutorialProgramTracks.find(
      (track) => track.id === 'rust-foundations'
    )!;

    expect(rust.offerings[0].modules.map((module) => module.id)).toEqual([
      'rust-foundations-basics',
      'rust-foundations-ownership',
      'rust-foundations-structs',
      'rust-foundations-error-handling',
      'rust-foundations-traits',
      'rust-foundations-lifetimes',
      'rust-foundations-collections',
      'rust-foundations-concurrency',
      'rust-foundations-testing',
    ]);
  });
});

describe('buildDraftOffering / buildDraftProgramTrack', () => {
  it('produces an offering that satisfies OfferingSchema while empty', () => {
    const offering = buildDraftOffering('draft-1', {
      displayName: 'Intro to Watercolor',
      subjectId: 'art',
    });

    expect(() => OfferingSchema.parse(offering)).not.toThrow();
    expect(offering.displayName).toBe('Intro to Watercolor');
  });

  it('produces a program track that validates end to end', () => {
    const track = buildDraftProgramTrack('draft-2', {
      displayName: 'Intro to Watercolor',
      subjectId: 'art',
    });

    expect(() => ProgramTrackSchema.parse(track)).not.toThrow();
    expect(track.requirements.children).toEqual([
      { kind: 'offering', offeringId: 'draft-2' },
    ]);
  });

  // A draft used to be filled with a placeholder module, lesson and writing
  // prompt, because the schema demanded content. Readers could see that
  // invented material in the catalog. An empty course is the honest shape.
  it('opens a course with no content rather than invented content', () => {
    const offering = buildDraftOffering('draft-3', {
      displayName: 'Anything',
      subjectId: 'anything',
    });

    expect(offering.modules).toEqual([]);
    expect(offering.activities).toEqual([]);
  });

  it('does not give a non-programming course a language', () => {
    const track = buildDraftProgramTrack('draft-4', {
      displayName: 'Intro to Watercolour',
      subjectId: 'art',
    });

    expect(track.supportedLanguageIds).toBeUndefined();
    expect(track.variantAxis).toBeUndefined();
  });
});

describe('authorizeOfferingAction', () => {
  const noRoles = {
    isPlatformOwner: false,
    isLearningAdmin: false,
    isCourseDesigner: false,
  };

  function ownership(
    overrides: Partial<OfferingOwnership> = {}
  ): OfferingOwnership {
    return {
      offeringId: 'offering-1',
      ownerProfileId: 'owner-profile',
      coEditorProfileIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  it('refuses a plain learner the right to create an offering', () => {
    expect(
      authorizeOfferingAction('learner-1', 'create', noRoles, undefined)
    ).toBe(false);
  });

  it('lets a course designer create an offering', () => {
    expect(
      authorizeOfferingAction(
        'designer-1',
        'create',
        { ...noRoles, isCourseDesigner: true },
        undefined
      )
    ).toBe(true);
  });

  it("refuses a course designer who owns nothing here from touching someone else's offering", () => {
    const roles = { ...noRoles, isCourseDesigner: true };
    const record = ownership();

    expect(authorizeOfferingAction('stranger', 'update', roles, record)).toBe(
      false
    );
    expect(authorizeOfferingAction('stranger', 'delete', roles, record)).toBe(
      false
    );
  });

  it('lets the owner update, delete, and manage co-editors on their own offering', () => {
    const roles = { ...noRoles, isCourseDesigner: true };
    const record = ownership({ ownerProfileId: 'owner-profile' });

    for (const action of ['update', 'delete', 'manageCoEditors'] as const) {
      expect(
        authorizeOfferingAction('owner-profile', action, roles, record)
      ).toBe(true);
    }
  });

  it('lets a co-editor update content but never delete or manage co-editors', () => {
    const roles = { ...noRoles, isCourseDesigner: true };
    const record = ownership({ coEditorProfileIds: ['editor-1'] });

    expect(authorizeOfferingAction('editor-1', 'update', roles, record)).toBe(
      true
    );
    expect(authorizeOfferingAction('editor-1', 'delete', roles, record)).toBe(
      false
    );
    expect(
      authorizeOfferingAction('editor-1', 'manageCoEditors', roles, record)
    ).toBe(false);
  });

  it('never lets a co-editor reassign ownership by acting as if they owned it', () => {
    const roles = { ...noRoles, isCourseDesigner: true };
    const record = ownership({ coEditorProfileIds: ['editor-1'] });

    expect(
      authorizeOfferingAction('editor-1', 'manageCoEditors', roles, record)
    ).toBe(false);
  });

  it("lets learning_admin update and delete anyone's offering", () => {
    const roles = { ...noRoles, isLearningAdmin: true };
    const record = ownership();

    expect(authorizeOfferingAction('admin-1', 'update', roles, record)).toBe(
      true
    );
    expect(authorizeOfferingAction('admin-1', 'delete', roles, record)).toBe(
      true
    );
  });

  it("lets a platform owner update and delete anyone's offering", () => {
    const roles = { ...noRoles, isPlatformOwner: true };
    const record = ownership();

    expect(
      authorizeOfferingAction('owner-console-1', 'update', roles, record)
    ).toBe(true);
    expect(
      authorizeOfferingAction('owner-console-1', 'delete', roles, record)
    ).toBe(true);
  });

  it('refuses any action on an offering with no ownership record for a non-privileged caller', () => {
    const roles = { ...noRoles, isCourseDesigner: true };

    expect(authorizeOfferingAction('someone', 'update', roles, undefined)).toBe(
      false
    );
  });
});

describe('lesson content, without a language axis', () => {
  const varied = LessonMetadataSchema.parse({
    id: 'l',
    title: 'Shading',
    slug: 'shading',
    content: [
      { variantId: 'graphite', format: 'markdown', sourcePath: 'g.md' },
      { variantId: 'ink', format: 'markdown', sourcePath: 'i.md' },
    ],
  });

  const plain = LessonMetadataSchema.parse({
    id: 'p',
    title: 'Colour theory',
    slug: 'colour-theory',
    content: [{ format: 'markdown', sourcePath: 'c.md' }],
  });

  it('accepts a lesson that varies along no axis at all', () => {
    expect(plain.content[0].variantId).toBeUndefined();
  });

  it('serves the requested variant', () => {
    expect(selectLessonContent(varied, 'ink').sourcePath).toBe('i.md');
  });

  it('falls back rather than failing when the variant is unknown', () => {
    expect(selectLessonContent(varied, 'oils').sourcePath).toBe('g.md');
  });

  it('prefers the unvaried rendition over the first one', () => {
    const mixed = LessonMetadataSchema.parse({
      id: 'm',
      title: 'm',
      slug: 'm',
      content: [
        { variantId: 'ink', format: 'markdown', sourcePath: 'i.md' },
        { format: 'markdown', sourcePath: 'any.md' },
      ],
    });

    expect(selectLessonContent(mixed).sourcePath).toBe('any.md');
  });

  it('ignores the preference on a lesson that does not vary', () => {
    expect(selectLessonContent(plain, 'ink').sourcePath).toBe('c.md');
  });

  // The exercise catalog matches lessons by variant, so a lesson with no
  // variants must not match a language, or a watercolour lesson sharing a
  // slug with a Go lesson would pick up its exercises.
  it('reports a variant only when the lesson actually carries one', () => {
    expect(lessonHasVariant(varied, 'ink')).toBe(true);
    expect(lessonHasVariant(varied, 'go')).toBe(false);
    expect(lessonHasVariant(plain, 'go')).toBe(false);
  });

  // Tracks are stored as JSONB, so rows written before this slice still say
  // languageVariants. They have to keep parsing.
  it('reads a lesson stored in the old languageVariants shape', () => {
    const legacy = LessonMetadataSchema.parse({
      id: 'old',
      title: 'Old',
      slug: 'old',
      languageVariants: [
        { languageId: 'go', strategy: 'file-variant', sourcePath: 'old.go.md' },
      ],
    });

    expect(legacy.content).toEqual([
      { variantId: 'go', format: 'file-variant', sourcePath: 'old.go.md' },
    ]);
    expect(lessonHasVariant(legacy, 'go')).toBe(true);
  });

  it('leaves a lesson alone when it already uses the new shape', () => {
    expect(varied.content).toHaveLength(2);
  });
});

describe('subjects and tracks without a language', () => {
  it('accepts a track that declares no language and no axis', () => {
    expect(() =>
      ProgramTrackSchema.parse({
        id: 'art',
        displayName: 'Watercolour',
        subjectIds: ['art'],
        focuses: [{ id: 'f', displayName: 'Art', subjectIds: ['art'] }],
        offerings: [
          {
            id: 'art-100',
            type: 'course',
            displayName: 'Watercolour',
            subjectId: 'art',
            level: 100,
            credits: 1,
            outcomeTags: ['art'],
            modules: [],
            activities: [],
          },
        ],
        requirements: {
          id: 'r',
          operator: 'AND',
          children: [{ kind: 'offering', offeringId: 'art-100' }],
        },
      })
    ).not.toThrow();
  });

  it('still validates the four built-in tracks, which do have an axis', () => {
    for (const track of tutorialProgramTracks) {
      expect(() => ProgramTrackSchema.parse(track)).not.toThrow();
      expect(track.variantAxis?.id).toBe('language');
    }
  });
});
