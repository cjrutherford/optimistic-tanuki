import {
  ProgramTrackSchema,
  RunnerProfileSchema,
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
  it('produces an offering that satisfies OfferingSchema despite having no real content yet', () => {
    const offering = buildDraftOffering('draft-1', {
      displayName: 'Intro to Watercolor',
      subjectId: 'art',
    });

    expect(offering.modules.length).toBeGreaterThan(0);
    expect(offering.activities.length).toBeGreaterThan(0);
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

  it('never bakes a programming language into the placeholder content', () => {
    const offering = buildDraftOffering('draft-3', {
      displayName: 'Anything',
      subjectId: 'anything',
    });

    expect(offering.modules[0].lessons[0].languageVariants[0].languageId).toBe(
      'any'
    );
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
