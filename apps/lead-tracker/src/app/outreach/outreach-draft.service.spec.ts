import { UserOnboardingProfile } from '@optimistic-tanuki/models';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadSource,
  LeadStatus,
} from '@optimistic-tanuki/models/leads-contracts';
import { LlmOnboardingAnalysisService } from '../llm-onboarding-analysis.service';
import { OutreachDraftService } from './outreach-draft.service';

const profile = {
  serviceOffer: 'Websites and booking systems for independent clinics',
  yearsExperience: '9',
  skills: ['WordPress', 'Stripe'],
  certifications: [],
  idealCustomer: 'Clinic owner',
  companySizeTarget: [],
  industries: ['Healthcare'],
  problemsSolved: ['Patients cannot book appointments online'],
  outcomes: ['Cut no-shows with automated reminders'],
  budgetRange: [],
  geographicFocus: 'Global',
  salesApproach: 'consultative',
  outreachMethod: ['email'],
  communicationStyle: 'Direct',
  leadSignalTypes: [],
  excludedCompanies: [],
  excludedIndustries: [],
  currentStep: 4,
} as UserOnboardingProfile;

const lead = {
  id: 'lead-1',
  name: 'Bright Smile Dental',
  company: 'Bright Smile Dental',
  source: LeadSource.OVERPASS,
  status: LeadStatus.NEW,
  value: 0,
  notes: 'Discovered via OpenStreetMap in Savannah (dentist).',
  isAutoDiscovered: true,
  searchKeywords: ['dentist'],
  presenceGaps: [
    { code: 'no-website', label: 'No website listed', weight: 40 },
  ],
  presenceGapScore: 40,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Lead;

const buildService = (
  llm: Partial<LlmOnboardingAnalysisService>
): OutreachDraftService =>
  new OutreachDraftService(llm as LlmOnboardingAnalysisService);

describe('OutreachDraftService', () => {
  describe('without a model', () => {
    const service = buildService({ isAvailable: false });

    it("writes a draft from the user's own material", async () => {
      const result = await service.generate(profile, lead, 1);

      expect(result.modelGenerated).toBe(false);
      expect(result.draft.body.join(' ')).toContain(profile.serviceOffer);
      expect(result.evidence.clean).toBe(true);
    });

    it('reports what it was allowed to say about the recipient', async () => {
      const result = await service.generate(profile, lead, 1);

      expect(result.evidence.observedSignals).toEqual(
        expect.arrayContaining(['No website listed', 'dentist'])
      );
    });
  });

  describe('with a model', () => {
    const withModelReturning = (draft: unknown) =>
      buildService({
        isAvailable: true,
        generateJson: jest.fn().mockResolvedValue(draft),
      } as unknown as Partial<LlmOnboardingAnalysisService>);

    it('keeps a sentence about the lead that the source actually observed', async () => {
      // The single most useful line in a cold email is a claim about the
      // *recipient*. Checked against the sender's profile alone it would be
      // stripped, because none of its words appear there.
      const service = withModelReturning({
        subject: 'Bright Smile Dental',
        greeting: 'Hello Bright Smile Dental,',
        opening: 'I noticed Bright Smile Dental has no website listed.',
        body: ['Websites and booking systems for independent clinics.'],
        closing: 'Worth a short conversation?',
        signOff: 'Thanks,',
      });

      const result = await service.generate(profile, lead, 1);

      expect(result.draft.opening).toContain('no website listed');
      expect(result.evidence.clean).toBe(true);
    });

    it('removes a claim about the lead that nothing observed', async () => {
      const service = withModelReturning({
        subject: 'Bright Smile Dental',
        greeting: 'Hello,',
        opening:
          'I saw your recent expansion into orthodontics and your franchise plans.',
        body: ['Websites and booking systems for independent clinics.'],
        closing: 'Worth a short conversation?',
        signOff: 'Thanks,',
      });

      const result = await service.generate(profile, lead, 1);

      expect(result.draft.opening).toBe('');
      expect(result.evidence.clean).toBe(false);
      expect(result.evidence.removedClaims.join(' ')).toContain(
        'the opening line'
      );
    });

    it('removes a credential the sender never claimed', async () => {
      const service = withModelReturning({
        subject: 'Bright Smile Dental',
        greeting: 'Hello,',
        opening: 'I noticed Bright Smile Dental has no website listed.',
        body: [
          'As a certified Salesforce architect I have rebuilt 40 dental portals.',
        ],
        closing: 'Worth a short conversation?',
        signOff: 'Thanks,',
      });

      const result = await service.generate(profile, lead, 1);

      expect(result.draft.body).toEqual([]);
      expect(result.evidence.removedClaims.join(' ')).toContain(
        'body paragraph 1'
      );
    });

    it('leaves the greeting and sign-off alone, so the draft stays sendable', async () => {
      const service = withModelReturning({
        subject: 'Bright Smile Dental',
        greeting: 'Hello Dr Alvarez,',
        opening: 'We are the number one agency in Georgia.',
        body: [],
        closing: 'Worth a short conversation?',
        signOff: 'Best regards,',
      });

      const result = await service.generate(profile, lead, 1);

      // The greeting carries no claim, and a message missing its greeting is
      // not something the user can send at all.
      expect(result.draft.greeting).toBe('Hello Dr Alvarez,');
      expect(result.draft.signOff).toBe('Best regards,');
      expect(result.draft.opening).toBe('');
    });

    it('falls back to the deterministic draft when the model fails', async () => {
      const service = buildService({
        isAvailable: true,
        generateJson: jest.fn().mockRejectedValue(new Error('ollama down')),
      } as unknown as Partial<LlmOnboardingAnalysisService>);

      const result = await service.generate(profile, lead, 1);

      expect(result.modelGenerated).toBe(false);
      expect(result.draft.body.length).toBeGreaterThan(0);
    });
  });
});
