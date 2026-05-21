import { TestBed } from '@angular/core/testing';
import {
    HttpClientTestingModule,
    HttpTestingController,
} from '@angular/common/http/testing';
import { LeadsService } from './leads.service';
import {
    LeadDiscoverySource,
    LeadTopicDiscoveryIntent,
    LeadFlagReason,
    LeadSource,
    LeadStatus,
} from './leads.types';

describe('LeadsService', () => {
    let service: LeadsService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [LeadsService],
        });

        service = TestBed.inject(LeadsService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should fetch leads from the gateway API', () => {
        const leads = [
            {
                id: 'lead-1',
                name: 'Test Lead',
                source: LeadSource.REMOTE_OK,
                status: LeadStatus.NEW,
                value: 1000,
                notes: '',
                isAutoDiscovered: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                isFlagged: false,
            },
        ];

        service.getLeads().subscribe((result) => {
            expect(result).toEqual(leads);
        });

        const req = httpMock.expectOne('/api/leads');
        expect(req.request.method).toBe('GET');
        req.flush(leads);
    });

    it('should patch a lead update', () => {
        const updatedLead = {
            id: 'lead-1',
            name: 'Updated Lead',
            source: LeadSource.REMOTE_OK,
            status: LeadStatus.CONTACTED,
            value: 1500,
            notes: 'Updated',
            isAutoDiscovered: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            isFlagged: false,
        };

        service.updateLead('lead-1', { status: LeadStatus.CONTACTED }).subscribe((result) => {
            expect(result.status).toBe(LeadStatus.CONTACTED);
        });

        const req = httpMock.expectOne('/api/leads/lead-1');
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ status: LeadStatus.CONTACTED });
        req.flush(updatedLead);
    });

    it('should fetch persisted topics', () => {
        const topics = [
            {
                id: 'topic-1',
                name: 'React',
                description: 'React contracts',
                keywords: ['react'],
                excludedTerms: [],
                discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
                sources: [LeadDiscoverySource.REMOTE_OK],
                googleMapsCities: undefined,
                googleMapsTypes: undefined,
                enabled: true,
                leadCount: 2,
            },
        ];

        service.getTopics().subscribe((result) => {
            expect(result).toEqual(topics);
        });

        const req = httpMock.expectOne('/api/leads/topics');
        expect(req.request.method).toBe('GET');
        req.flush(topics);
    });

    it('should create a topic through the gateway API', () => {
        const topic = {
            id: 'topic-1',
            name: 'Cloud',
            description: 'Cloud work',
            keywords: ['aws'],
            excludedTerms: ['wordpress', 'php'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            googleMapsCities: undefined,
            googleMapsTypes: undefined,
            enabled: true,
            leadCount: 0,
        };

        service
            .createTopic({
                name: 'Cloud',
                description: 'Cloud work',
                keywords: ['aws'],
                sources: [LeadDiscoverySource.REMOTE_OK],
                excludedTerms: ['wordpress', 'php'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            })
            .subscribe((result) => {
                expect(result).toEqual(topic);
            });

        const req = httpMock.expectOne('/api/leads/topics');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            name: 'Cloud',
            description: 'Cloud work',
            keywords: ['aws'],
            sources: [LeadDiscoverySource.REMOTE_OK],
            excludedTerms: ['wordpress', 'php'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
        });
        req.flush(topic);
    });

    it('should request location suggestions through the gateway API', () => {
        service.searchLocations('sav').subscribe((result) => {
            expect(result).toEqual([
                {
                    description: 'Savannah, GA, USA',
                    primaryText: 'Savannah',
                    secondaryText: 'GA, USA',
                    placeId: 'place-1',
                },
            ]);
        });

        const req = httpMock.expectOne('/api/leads/locations/autocomplete?q=sav');
        expect(req.request.method).toBe('GET');
        req.flush([
            {
                description: 'Savannah, GA, USA',
                primaryText: 'Savannah',
                secondaryText: 'GA, USA',
                placeId: 'place-1',
            },
        ]);
    });

    it('should include Google Maps fields when creating a Google Maps topic', () => {
        const topic = {
            id: 'topic-local',
            name: 'Savannah Local',
            description: 'Local opportunities',
            keywords: ['restaurants'],
            excludedTerms: [],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['restaurants'],
            enabled: true,
            leadCount: 0,
        };

        service
            .createTopic({
                name: 'Savannah Local',
                description: 'Local opportunities',
                keywords: ['restaurants'],
                sources: [LeadDiscoverySource.GOOGLE_MAPS],
                googleMapsCities: ['Savannah, GA'],
                googleMapsTypes: ['restaurants'],
            })
            .subscribe((result) => {
                expect(result).toEqual(topic);
            });

        const req = httpMock.expectOne('/api/leads/topics');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            name: 'Savannah Local',
            description: 'Local opportunities',
            keywords: ['restaurants'],
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['restaurants'],
        });
        req.flush(topic);
    });

    it('should toggle a topic with PATCH', () => {
        const topic = {
            id: 'topic-1',
            name: 'Cloud',
            description: 'Cloud work',
            keywords: ['aws'],
            excludedTerms: [],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            googleMapsCities: undefined,
            googleMapsTypes: undefined,
            enabled: true,
            leadCount: 0,
        };

        service.toggleTopic(topic).subscribe((result) => {
            expect(result.enabled).toBe(false);
        });

        const req = httpMock.expectOne('/api/leads/topics/topic-1');
        expect(req.request.method).toBe('PATCH');
        expect(req.request.body).toEqual({ enabled: false });
        req.flush({ ...topic, enabled: false });
    });

    it('should run topic discovery through the gateway API', () => {
        const result = {
            topicId: 'topic-1',
            linkedLeadCount: 2,
            addedCount: 2,
            removedCount: 0,
            queued: false,
            lastRun: new Date().toISOString(),
        };

        service.runTopicDiscovery('topic-1').subscribe((response) => {
            expect(response).toEqual(result);
        });

        const req = httpMock.expectOne('/api/leads/topics/topic-1/discover');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({});
        req.flush(result);
    });

    it('should confirm onboarding topics through the gateway API', () => {
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
        const payload = [
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

        service.confirmOnboarding(profile as any, payload).subscribe((response) => {
            expect(response).toEqual({ topics: [{ id: 'topic-1' }] });
        });

        const req = httpMock.expectOne('/api/leads/onboarding/confirm');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ profile, topics: payload });
        req.flush({ topics: [{ id: 'topic-1' }] });
    });

    it('should analyze a mad-lib prompt through the gateway API', () => {
        service
            .analyzeMadLib('I am a consultant who specializes in React modernization.')
            .subscribe((response) => {
                expect(response.suggestedServiceOffer).toBe('React modernization consulting');
            });

        const req = httpMock.expectOne('/api/leads/onboarding/mad-lib/analyze');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            text: 'I am a consultant who specializes in React modernization.',
        });
        req.flush({
            summary: 'Consultant focused on React modernization.',
            suggestedServiceOffer: 'React modernization consulting',
            suggestedSkills: ['React', 'TypeScript'],
            suggestedIdealCustomer: 'VP Engineering',
        });
    });

    it('should submit DISC transcript turns through the gateway API', () => {
        service
            .advanceDiscInterview({
                transcript: [{ role: 'user', text: 'I like driving fast decisions.' }],
            })
            .subscribe((response) => {
                expect(response.complete).toBe(false);
                expect(response.nextQuestion).toContain('teammate');
            });

        const req = httpMock.expectOne('/api/leads/onboarding/disc/advance');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            transcript: [{ role: 'user', text: 'I like driving fast decisions.' }],
        });
        req.flush({
            complete: false,
            nextQuestion: 'Tell me how you react when a teammate misses a deadline.',
        });
    });

    it('should upload a resume as multipart form data', () => {
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
            experience: ['10+ years building B2B SaaS applications'],
            certifications: ['AWS Certified'],
        });
    });

    it('should fetch flags for a lead', () => {
        const flags = [
            {
                id: 'flag-1',
                leadId: 'lead-1',
                reasons: [LeadFlagReason.SPAM],
                notes: 'Not a fit',
                createdAt: new Date(),
            },
        ];

        service.getLeadFlags('lead-1').subscribe((result) => {
            expect(result).toEqual(flags);
        });

        const req = httpMock.expectOne('/api/leads/lead-1/flags');
        expect(req.request.method).toBe('GET');
        req.flush(flags);
    });

    it('should create a flag through the gateway API', () => {
        const flag = {
            id: 'flag-1',
            leadId: 'lead-1',
            reasons: [LeadFlagReason.SPAM],
            notes: 'Not a fit',
            createdAt: new Date(),
        };

        service
            .flagLead('lead-1', {
                reasons: [LeadFlagReason.SPAM],
                notes: 'Not a fit',
            })
            .subscribe((result) => {
                expect(result).toEqual(flag);
            });

        const req = httpMock.expectOne('/api/leads/lead-1/flags');
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({
            reasons: [LeadFlagReason.SPAM],
            notes: 'Not a fit',
        });
        req.flush(flag);
    });
});
