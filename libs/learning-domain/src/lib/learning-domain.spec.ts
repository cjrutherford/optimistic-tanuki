import {
  ProgramTrackSchema,
  calculateTotalCredits,
  evaluateRequirementGroup,
  isOfferingUnlocked,
} from './learning-domain';
import { sampleProgramTrack } from './sample-program';

describe('learning-domain', () => {
  it('calculates credit totals from completed offerings', () => {
    const credits = calculateTotalCredits(sampleProgramTrack.offerings, [
      'systems-100-core',
      'systems-200-capstone-project',
    ]);

    expect(credits).toBe(7);
  });

  it('evaluates requirement group completion for n-of-m requirements', () => {
    const incomplete = evaluateRequirementGroup(sampleProgramTrack.requirements, [
      'systems-100-core',
    ]);
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
});
