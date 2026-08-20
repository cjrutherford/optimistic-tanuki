import { UserOnboardingProfile } from '@optimistic-tanuki/models';
import {
  buildFactBase,
  findGaps,
  guardCoverLetter,
  guardResume,
  isStatementSupported,
} from './fact-guard';

const profile = {
  serviceOffer: 'React modernization',
  yearsExperience: '10+ years',
  skills: ['React', 'TypeScript', 'Node'],
  certifications: ['AWS Certified Solutions Architect'],
  resumeDerivedSkills: ['GraphQL'],
  resumeDerivedCertifications: [],
  resumeParseSummary:
    'Senior frontend engineer who modernized legacy React applications.',
  resumeRoleSummaries: [
    {
      title: 'Senior Frontend Engineer',
      company: 'Globex',
      dateRange: '2020-2024',
      skills: ['React', 'TypeScript'],
      industries: ['SaaS'],
      highlights: [
        'Migrated a legacy AngularJS dashboard to React, cutting load time by 40%',
      ],
      outcomes: ['faster releases'],
    },
  ],
  idealCustomer: 'VP Engineering',
  industries: ['SaaS'],
  problemsSolved: ['legacy frontend'],
  outcomes: ['faster releases'],
} as unknown as UserOnboardingProfile;

const facts = buildFactBase(profile);

describe('anti-fabrication fact guard', () => {
  describe('isStatementSupported', () => {
    it('accepts a highlight taken from the resume', () => {
      expect(
        isStatementSupported(
          'Migrated a legacy AngularJS dashboard to React, cutting load time by 40%',
          facts
        )
      ).toBe(true);
    });

    it('rejects an invented metric', () => {
      // 40% is real; 85% appears nowhere in the user's material.
      expect(
        isStatementSupported(
          'Migrated a legacy AngularJS dashboard to React, cutting load time by 85%',
          facts
        )
      ).toBe(false);
    });

    it('rejects a plausible but unsupported claim', () => {
      expect(
        isStatementSupported(
          'Led a distributed team of fifteen engineers across three continents',
          facts
        )
      ).toBe(false);
    });
  });

  describe('guardResume', () => {
    it('strips an employer the user never worked for', () => {
      const { value, removedClaims } = guardResume(
        {
          summary: '',
          skills: [],
          certifications: [],
          roles: [
            {
              title: 'Staff Engineer',
              company: 'Initech',
              highlights: ['Did great work'],
            },
          ],
        },
        facts
      );

      expect(value.roles).toHaveLength(0);
      expect(removedClaims.join(' ')).toContain('Initech');
    });

    it('keeps a real employer', () => {
      const { value } = guardResume(
        {
          summary: '',
          skills: [],
          certifications: [],
          roles: [
            {
              title: 'Senior Frontend Engineer',
              company: 'Globex',
              highlights: [],
            },
          ],
        },
        facts
      );

      expect(value.roles).toHaveLength(1);
    });

    it('strips a certification the user does not hold', () => {
      const { value, removedClaims } = guardResume(
        {
          summary: '',
          skills: [],
          roles: [],
          certifications: [
            'AWS Certified Solutions Architect',
            'Certified Kubernetes Administrator',
          ],
        },
        facts
      );

      expect(value.certifications).toEqual([
        'AWS Certified Solutions Architect',
      ]);
      expect(removedClaims.join(' ')).toContain('Kubernetes');
    });

    it('enforces the E8 subset rule: generated skills are always a subset of known skills', () => {
      const { value } = guardResume(
        {
          summary: '',
          roles: [],
          certifications: [],
          skills: ['React', 'TypeScript', 'Rust', 'Kubernetes'],
        },
        facts
      );

      const known = new Set([
        ...(profile.skills || []),
        ...(profile.resumeDerivedSkills || []),
      ]);
      for (const skill of value.skills) {
        expect(known.has(skill)).toBe(true);
      }
      expect(value.skills).not.toContain('Rust');
    });
  });

  describe('guardCoverLetter', () => {
    it('drops a paragraph making claims the profile cannot support', () => {
      const { value, removedClaims } = guardCoverLetter(
        {
          greeting: 'Dear Hiring Manager,',
          opening: 'I modernized legacy React applications for SaaS companies.',
          body: [
            'I hold a PhD in astrophysics and founded three unicorn startups.',
          ],
          closing: '',
          signOff: 'Sincerely,',
        },
        facts
      );

      expect(value.body).toHaveLength(0);
      expect(value.opening).toBeTruthy();
      expect(removedClaims.length).toBeGreaterThan(0);
    });

    it('leaves the greeting and sign-off alone', () => {
      const { value } = guardCoverLetter(
        {
          greeting: 'Dear Hiring Manager,',
          opening: '',
          body: [],
          closing: '',
          signOff: 'Sincerely,',
        },
        facts
      );

      expect(value.greeting).toBe('Dear Hiring Manager,');
      expect(value.signOff).toBe('Sincerely,');
    });
  });

  describe('findGaps', () => {
    it('reports requirements with no support instead of papering over them', () => {
      const gaps = findGaps(
        [
          'Must have 5 years experience with Kubernetes and Terraform.',
          'Experience with React and TypeScript required.',
        ].join('\n'),
        facts
      );

      expect(gaps.join(' ')).toContain('Kubernetes');
      expect(gaps.join(' ')).not.toContain('React and TypeScript');
    });
  });
});
