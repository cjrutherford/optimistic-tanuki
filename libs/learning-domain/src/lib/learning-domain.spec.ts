import {
  ProgramTrackSchema,
  RunnerProfileSchema,
  calculateTotalCredits,
  evaluateRequirementGroup,
  isOfferingUnlocked,
} from './learning-domain';
import { sampleProgramTrack, tutorialProgramTracks } from './sample-program';

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
});
