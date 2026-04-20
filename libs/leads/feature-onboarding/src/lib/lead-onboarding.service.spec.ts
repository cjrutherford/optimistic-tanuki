import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  LeadDiscoverySource,
  LeadTopicDiscoveryIntent,
} from '@optimistic-tanuki/leads-contracts';

import { LeadOnboardingService } from './lead-onboarding.service';

describe('LeadOnboardingService', () => {
  let service: LeadOnboardingService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(LeadOnboardingService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('confirms onboarding with profile and generated topics', () => {
    const profile = {
      serviceOffer: 'React modernization consulting',
      yearsExperience: '10+',
      skills: ['React'],
      certifications: [],
      idealCustomer: 'VP Engineering',
      companySizeTarget: ['50-250'],
      industries: ['SaaS'],
      problemsSolved: ['legacy frontend'],
      outcomes: ['faster releases'],
      budgetRange: ['$25k-$100k'],
      geographicFocus: 'Global',
      salesApproach: 'Consultative',
      outreachMethod: ['Email'],
      communicationStyle: 'Direct',
      leadSignalTypes: ['budget'],
      excludedCompanies: [],
      excludedIndustries: [],
      currentStep: 4,
    };
    const topics = [
      {
        name: 'React modernization roles',
        description: 'Remote and hybrid product engineering roles',
        keywords: ['react modernization'],
        excludedTerms: ['wordpress'],
        discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
        sources: [LeadDiscoverySource.REMOTE_OK],
        priority: 1,
        targetCompanies: ['SaaS companies'],
        buyerPersona: '',
        painPoints: ['slow delivery'],
        valueProposition: 'Modernize the stack',
        searchStrategy: 'balanced' as const,
        confidence: 90,
      },
    ];

    service.confirmOnboarding(profile as any, topics).subscribe((response) => {
      expect(response).toEqual({ topics: [{ id: 'topic-1' }] });
    });

    const req = httpMock.expectOne('/api/leads/onboarding/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ profile, topics });
    req.flush({ topics: [{ id: 'topic-1' }] });
  });

  it('uploads a resume as multipart form data', () => {
    const file = new File(['resume text'], 'resume.pdf', {
      type: 'application/pdf',
    });

    service.parseResume(file).subscribe((response) => {
      expect(response.skills).toEqual(['React', 'TypeScript']);
    });

    const req = httpMock.expectOne('/api/leads/onboarding/resume/parse');
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect(req.request.body.get('file')).toBe(file);
    req.flush({
      summary: 'Senior frontend consultant',
      skills: ['React', 'TypeScript'],
    });
  });
});
