import { UserOnboardingProfile } from '@optimistic-tanuki/models';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import { ApplicationGenerationService } from './application-generation.service';

const profile = {
  serviceOffer: 'React modernization',
  yearsExperience: '10+ years',
  skills: ['React', 'TypeScript', 'Node'],
  certifications: ['AWS Certified Solutions Architect'],
  resumeDerivedSkills: ['GraphQL'],
  resumeDerivedCertifications: [],
  resumeParseSummary:
    'Senior frontend engineer who modernized legacy React apps.',
  resumeRoleSummaries: [
    {
      title: 'Senior Frontend Engineer',
      company: 'Globex',
      dateRange: '2020-2024',
      skills: ['React'],
      industries: ['SaaS'],
      highlights: [
        'Migrated a legacy dashboard to React, cutting load time by 40%',
        'Introduced GraphQL to reduce over-fetching',
      ],
      outcomes: [],
    },
  ],
  communicationStyle: 'Direct',
} as unknown as UserOnboardingProfile;

const lead = {
  id: 'lead-1',
  name: 'Senior React Engineer',
  company: 'Initech',
  notes: 'We need React and GraphQL experience. Kubernetes required.',
} as unknown as Lead;

describe('ApplicationGenerationService', () => {
  describe('with no model available', () => {
    const service = new ApplicationGenerationService({
      isAvailable: false,
    } as never);

    it("still produces a usable application from the user's own material", async () => {
      const result = await service.generate(profile, lead, 1);

      expect(result.modelGenerated).toBe(false);
      expect(result.resume.roles).toHaveLength(1);
      expect(result.resume.roles[0].company).toBe('Globex');
      expect(result.coverLetter.greeting).toContain('Initech');
    });

    it('passes the fact guard cleanly, because it only copies existing facts', async () => {
      const result = await service.generate(profile, lead, 1);

      // The deterministic path composes no new sentences, so there is nothing
      // for the guard to remove. If this ever fails it is a real bug.
      expect(result.evidence.removedClaims).toEqual([]);
      expect(result.evidence.clean).toBe(true);
    });

    it('orders highlights by how many posting terms they match', async () => {
      const graphqlHeavy = {
        ...lead,
        notes: 'We need GraphQL to fix over-fetching. Kubernetes required.',
      } as unknown as Lead;

      const result = await service.generate(profile, graphqlHeavy, 1);

      // That highlight matches two posting terms (graphql, fetching) against
      // the other's zero, so relevance ordering must lift it to the top.
      expect(result.resume.roles[0].highlights[0]).toContain('GraphQL');
    });

    it('reports the requirement the candidate cannot meet', async () => {
      const result = await service.generate(profile, lead, 1);
      expect(result.evidence.gaps.join(' ')).toContain('Kubernetes');
    });
  });

  describe('with a model that fabricates', () => {
    const fabricating = {
      isAvailable: true,
      generateJson: jest.fn(),
    };
    const service = new ApplicationGenerationService(fabricating as never);

    beforeEach(() => {
      fabricating.generateJson
        .mockResolvedValueOnce({
          summary: 'Award-winning engineer.',
          skills: ['React', 'Kubernetes'],
          certifications: ['Certified Kubernetes Administrator'],
          roles: [
            {
              title: 'VP of Engineering',
              company: 'Initech',
              highlights: ['Led 200 engineers'],
            },
            {
              title: 'Senior Frontend Engineer',
              company: 'Globex',
              highlights: [
                'Migrated a legacy dashboard to React, cutting load time by 40%',
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          greeting: 'Dear Initech hiring team,',
          opening: 'I modernized legacy React applications.',
          body: ['I personally scaled Kubernetes clusters to 10,000 nodes.'],
          closing: '',
          signOff: 'Sincerely,',
        });
    });

    it('removes the invented employer, credential, and skill', async () => {
      const result = await service.generate(profile, lead, 1);

      const companies = result.resume.roles.map((role) => role.company);
      expect(companies).not.toContain('Initech');
      expect(companies).toContain('Globex');
      expect(result.resume.certifications).not.toContain(
        'Certified Kubernetes Administrator'
      );
      expect(result.resume.skills).not.toContain('Kubernetes');
    });

    it('removes the fabricated cover-letter claim', async () => {
      const result = await service.generate(profile, lead, 1);
      expect(result.coverLetter.body).toHaveLength(0);
    });

    it('reports what it removed rather than hiding it', async () => {
      const result = await service.generate(profile, lead, 1);

      expect(result.evidence.clean).toBe(false);
      expect(result.evidence.removedClaims.length).toBeGreaterThan(0);
      expect(result.evidence.removedClaims.join(' ')).toContain('Initech');
    });
  });

  describe('when the model call fails', () => {
    it('falls back to the deterministic path instead of erroring', async () => {
      const failing = {
        isAvailable: true,
        generateJson: jest.fn().mockRejectedValue(new Error('ollama down')),
      };
      const service = new ApplicationGenerationService(failing as never);

      const result = await service.generate(profile, lead, 3);

      expect(result.modelGenerated).toBe(false);
      expect(result.version).toBe(3);
      expect(result.resume.roles).toHaveLength(1);
    });
  });
});
