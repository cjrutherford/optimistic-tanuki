import {
  LessonContentSchema,
  LessonMetadataSchema,
  Offering,
  OfferingSchema,
  groupTracksBySubject,
  isOfferingVisibleTo,
  subjectDisplayName,
  visibleTracks,
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

describe('authored lesson content', () => {
  const rendition = (extra: Record<string, unknown>) =>
    LessonContentSchema.safeParse({ format: 'markdown', ...extra });

  it('accepts a lesson written inside the product', () => {
    expect(
      rendition({ body: '# Colour theory\n\nStart with three pigments.' })
        .success
    ).toBe(true);
  });

  it('accepts a lesson that points at a file', () => {
    expect(rendition({ sourcePath: 'basics/01-intro.md' }).success).toBe(true);
  });

  // Two sources of truth and no rule for which one wins is worse than either.
  it('refuses a rendition carrying both a body and a path', () => {
    expect(rendition({ body: 'words', sourcePath: 'a.md' }).success).toBe(
      false
    );
  });

  it('refuses a rendition carrying neither', () => {
    expect(rendition({}).success).toBe(false);
  });

  it('refuses an empty body, which is not the same as having one', () => {
    expect(rendition({ body: '' }).success).toBe(false);
  });
});

describe('publication status', () => {
  function offering(overrides: Partial<Offering> = {}): Offering {
    return OfferingSchema.parse({
      id: 'o-1',
      type: 'course',
      displayName: 'A course',
      subjectId: 'art',
      level: 100,
      credits: 1,
      outcomeTags: ['art'],
      modules: [],
      activities: [],
      ...overrides,
    });
  }

  function ownedBy(ownerProfileId: string, coEditorProfileIds: string[] = []) {
    return {
      offeringId: 'o-1',
      ownerProfileId,
      coEditorProfileIds,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
  }

  // Defaulting to published would have shown every course stored before this
  // existed to every learner, which is the opposite of what an author expects.
  it('treats an offering with no status as a draft', () => {
    expect(offering().status).toBe('draft');
  });

  it('shows a published course to an anonymous visitor', () => {
    expect(
      isOfferingVisibleTo(offering({ status: 'published' }), undefined, {})
    ).toBe(true);
  });

  it('hides a draft from an anonymous visitor', () => {
    expect(isOfferingVisibleTo(offering(), ownedBy('someone'), {})).toBe(false);
  });

  it('hides a draft from a signed-in learner who does not own it', () => {
    expect(
      isOfferingVisibleTo(offering(), ownedBy('someone'), {
        profileId: 'learner',
      })
    ).toBe(false);
  });

  it('shows a draft to the author writing it', () => {
    expect(
      isOfferingVisibleTo(offering(), ownedBy('author'), {
        profileId: 'author',
      })
    ).toBe(true);
  });

  it('shows a draft to a co-editor', () => {
    expect(
      isOfferingVisibleTo(offering(), ownedBy('author', ['helper']), {
        profileId: 'helper',
      })
    ).toBe(true);
  });

  it('shows every draft to the people who answer for the platform', () => {
    expect(
      isOfferingVisibleTo(offering(), ownedBy('someone'), {
        profileId: 'admin',
        seesEveryDraft: true,
      })
    ).toBe(true);
  });

  // Fails closed: a draft with no ownership record belongs to nobody, so
  // nobody but an admin sees it.
  it('hides a draft with no ownership record', () => {
    expect(
      isOfferingVisibleTo(offering(), undefined, { profileId: 'anyone' })
    ).toBe(false);
  });

  describe('visibleTracks', () => {
    const track = {
      id: 't',
      displayName: 'T',
      subjectIds: ['art'],
      focuses: [{ id: 'f', displayName: 'F', subjectIds: ['art'] }],
      offerings: [
        offering({ id: 'published-1', status: 'published' }),
        offering({ id: 'draft-1' }),
      ],
      requirements: {
        id: 'r',
        operator: 'AND' as const,
        children: [{ kind: 'offering' as const, offeringId: 'published-1' }],
      },
    };

    it('keeps the published offering and drops the draft', () => {
      const [visible] = visibleTracks(
        [track],
        new Map([['draft-1', ownedBy('someone')]]),
        { profileId: 'learner' }
      );

      expect(visible.offerings.map((item) => item.id)).toEqual(['published-1']);
    });

    it('drops a track whose every offering is hidden', () => {
      const draftsOnly = { ...track, offerings: [offering({ id: 'draft-1' })] };

      expect(
        visibleTracks(
          [draftsOnly],
          new Map([['draft-1', ownedBy('someone')]]),
          {
            profileId: 'learner',
          }
        )
      ).toEqual([]);
    });

    it('leaves the original tracks untouched', () => {
      visibleTracks([track], new Map(), { profileId: 'learner' });

      expect(track.offerings).toHaveLength(2);
    });
  });
});

describe('publishing is not editing', () => {
  const ownership = {
    offeringId: 'o-1',
    ownerProfileId: 'author',
    coEditorProfileIds: ['helper'],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const noRoles = {
    isPlatformOwner: false,
    isLearningAdmin: false,
    isCourseDesigner: true,
  };

  it('lets a co-editor revise a course', () => {
    expect(
      authorizeOfferingAction('helper', 'update', noRoles, ownership)
    ).toBe(true);
  });

  it('does not let a co-editor decide it is ready', () => {
    expect(
      authorizeOfferingAction('helper', 'publish', noRoles, ownership)
    ).toBe(false);
  });

  it('lets the owner publish', () => {
    expect(
      authorizeOfferingAction('author', 'publish', noRoles, ownership)
    ).toBe(true);
  });

  it('lets a learning admin publish', () => {
    expect(
      authorizeOfferingAction(
        'admin',
        'publish',
        { ...noRoles, isLearningAdmin: true },
        ownership
      )
    ).toBe(true);
  });
});

describe('browsing by subject', () => {
  function track(id: string, subjectIds: string[], focusNames: string[] = []) {
    return {
      id,
      displayName: id,
      subjectIds,
      focuses: focusNames.map((displayName, index) => ({
        id: `${id}-f${index}`,
        displayName,
        subjectIds,
      })),
      offerings: [
        OfferingSchema.parse({
          id: `${id}-100`,
          type: 'course',
          displayName: id,
          subjectId: subjectIds[0],
          level: 100,
          credits: 1,
          outcomeTags: ['x'],
          modules: [],
          activities: [],
        }),
      ],
      requirements: {
        id: `${id}-r`,
        operator: 'AND' as const,
        children: [{ kind: 'offering' as const, offeringId: `${id}-100` }],
      },
    };
  }

  // A platform that has to know its subjects in advance is not universal.
  it('names a subject nobody registered', () => {
    expect(subjectDisplayName('marine-biology')).toBe('Marine Biology');
  });

  it('uses the nicer name for a subject it does know', () => {
    expect(subjectDisplayName('programming')).toBe('Programming');
  });

  it('handles a single-word subject', () => {
    expect(subjectDisplayName('art')).toBe('Art');
  });

  it('groups tracks under the subjects they name', () => {
    const groups = groupTracksBySubject([
      track('go', ['programming']),
      track('watercolour', ['art']),
    ]);

    expect(groups.map((group) => group.subjectId)).toEqual([
      'art',
      'programming',
    ]);
  });

  it('orders subjects by name, not by whatever the catalog returned', () => {
    const groups = groupTracksBySubject([
      track('zebra', ['zoology']),
      track('apple', ['agriculture']),
    ]);

    expect(groups.map((group) => group.displayName)).toEqual([
      'Agriculture',
      'Zoology',
    ]);
  });

  // A course on computational biology belongs in both places, and picking one
  // for the visitor would hide it from the other.
  it('files a track that spans subjects under each of them', () => {
    const groups = groupTracksBySubject([
      track('compbio', ['programming', 'biology']),
    ]);

    expect(groups).toHaveLength(2);
    for (const group of groups) {
      expect(group.tracks.map((item) => item.id)).toEqual(['compbio']);
    }
  });

  it('collects the focus names within a subject, without repeating them', () => {
    const groups = groupTracksBySubject([
      track('go', ['programming'], ['Foundations']),
      track('rust', ['programming'], ['Foundations', 'Systems']),
    ]);

    expect(groups[0].focusNames).toEqual(['Foundations', 'Systems']);
  });

  it('returns nothing for an empty catalog', () => {
    expect(groupTracksBySubject([])).toEqual([]);
  });
});
