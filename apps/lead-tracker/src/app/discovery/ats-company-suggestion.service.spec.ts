import { LeadStatus } from '@optimistic-tanuki/models/leads-contracts';
import { AtsCompanySuggestionService } from './ats-company-suggestion.service';

const repo = (rows: unknown[]) => ({ find: jest.fn().mockResolvedValue(rows) });

describe('AtsCompanySuggestionService', () => {
  const lookupFor = (verified: string[]) => ({
    lookup: jest.fn(async (name: string) =>
      verified.includes(name)
        ? [
            {
              provider: 'greenhouse' as const,
              token: name.toLowerCase().replace(/\s/g, ''),
              label: name,
              openingCount: 5,
            },
          ]
        : []
    ),
  });

  const build = (
    leads: unknown[],
    flags: unknown[],
    onboarding: unknown[],
    verified: string[]
  ) => {
    const lookup = lookupFor(verified);
    const service = new AtsCompanySuggestionService(
      repo(leads) as never,
      repo(flags) as never,
      repo(onboarding) as never,
      lookup as never
    );
    return { service, lookup };
  };

  it('ranks a company the user actually pursued above one merely seen', async () => {
    const { service } = build(
      [
        { id: 'l1', company: 'Pursued Co', status: LeadStatus.CONTACTED },
        { id: 'l2', company: 'Seen Co', status: LeadStatus.NEW },
      ],
      [],
      [],
      ['Pursued Co', 'Seen Co']
    );

    const suggestions = await service.suggest('profile-1');

    expect(suggestions.map((s) => s.label)).toEqual(['Pursued Co', 'Seen Co']);
    expect(suggestions[0].signal).toBe('pursued-lead');
    expect(suggestions[0].reason).toContain('pursued');
  });

  it('never suggests a company whose lead the user flagged', async () => {
    const { service } = build(
      [
        { id: 'l1', company: 'Rejected Co', status: LeadStatus.CONTACTED },
        { id: 'l2', company: 'Fine Co', status: LeadStatus.NEW },
      ],
      [{ leadId: 'l1' }],
      [],
      ['Rejected Co', 'Fine Co']
    );

    const suggestions = await service.suggest('profile-1');

    // Flagging is an explicit rejection; echoing it back would be obtuse.
    expect(suggestions.map((s) => s.label)).not.toContain('Rejected Co');
    expect(suggestions.map((s) => s.label)).toContain('Fine Co');
  });

  it('suggests past employers from the parsed resume', async () => {
    const { service } = build(
      [],
      [],
      [
        {
          profile: { resumeRoleSummaries: [{ company: 'Old Employer' }] },
        },
      ],
      ['Old Employer']
    );

    const suggestions = await service.suggest('profile-1');

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].signal).toBe('past-employer');
  });

  it('drops candidates with no verifiable board rather than guessing a token', async () => {
    const { service } = build(
      [{ id: 'l1', company: 'No Board Co', status: LeadStatus.CONTACTED }],
      [],
      [],
      [] // nothing verifies
    );

    expect(await service.suggest('profile-1')).toEqual([]);
  });

  it('returns nothing without a profile rather than querying', async () => {
    const { service, lookup } = build([], [], [], []);
    expect(await service.suggest('')).toEqual([]);
    expect(lookup.lookup).not.toHaveBeenCalled();
  });
});
