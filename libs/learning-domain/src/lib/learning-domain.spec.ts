import {
  ProgramTrackSchema,
  RunnerProfileSchema,
  calculateTotalCredits,
  evaluateRequirementGroup,
  isOfferingUnlocked,
} from './learning-domain';
import {
  programmingBasicsProgramTrack,
  sampleProgramTrack,
  tutorialProgramTracks,
} from './sample-program';

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
    expect(() => ProgramTrackSchema.parse(programmingBasicsProgramTrack)).not.toThrow();
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
      { id: 'rust-foundations', modules: 9, lessons: 23 },
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
