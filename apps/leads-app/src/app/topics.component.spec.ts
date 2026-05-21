import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { TopicsComponent } from './topics.component';
import { LeadsService } from './leads.service';
import { LeadDiscoverySource, LeadTopicDiscoveryIntent } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('TopicsComponent', () => {
    const leadsServiceStub = {
        getTopics: jest.fn(),
        createTopic: jest.fn(),
        updateTopic: jest.fn(),
        deleteTopic: jest.fn(),
        toggleTopic: jest.fn(),
        runTopicDiscovery: jest.fn(),
        getTopicDiscoveryStatus: jest.fn(),
        searchLocations: jest.fn(),
    };

    const themeServiceStub = {
        setPersonality: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        leadsServiceStub.getTopics.mockReturnValue(of([]));
        leadsServiceStub.searchLocations.mockReturnValue(of([]));
        leadsServiceStub.getTopicDiscoveryStatus.mockReturnValue(
            of({
                topicId: 'topic-default',
                linkedLeadCount: 0,
                addedCount: 0,
                removedCount: 0,
                queued: false,
                status: 'completed',
                providerResults: [],
                message: 'Discovery completed.',
            })
        );

        await TestBed.configureTestingModule({
            imports: [TopicsComponent],
            providers: [
                provideRouter([]),
                {
                    provide: LeadsService,
                    useValue: leadsServiceStub,
                },
                {
                    provide: ThemeService,
                    useValue: themeServiceStub,
                },
            ],
        }).compileComponents();
    });

    it('creates a topic and runs discovery immediately', () => {
        leadsServiceStub.createTopic.mockReturnValue(
            of({
                id: 'topic-1',
                name: 'React',
                description: '',
                keywords: ['react'],
                excludedTerms: ['wordpress', 'php'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.REMOTE_OK],
                enabled: true,
                leadCount: 0,
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        const component = fixture.componentInstance;
        component.openAddForm();
        component.topicForm = {
            name: 'React',
            description: '',
            keywords: 'react',
            excludedTerms: 'wordpress, php',
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            googleMapsCities: '',
            googleMapsTypes: '',
            enabled: true,
        };

        component.submitTopic();

        expect(leadsServiceStub.createTopic).toHaveBeenCalledWith({
            name: 'React',
            description: '',
            keywords: ['react'],
            excludedTerms: ['wordpress', 'php'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
        });
        expect(leadsServiceStub.runTopicDiscovery).not.toHaveBeenCalled();
    });

    it('renders the add topic form inside a modal overlay', () => {
        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.detectChanges();

        expect(fixture.debugElement.query(By.css('.topic-modal-overlay'))).not.toBeNull();
        expect(fixture.debugElement.query(By.css('.topic-modal-shell .add-topic-card'))).not.toBeNull();
    });

    it('loads a topic into the form for editing and runs discovery after save', () => {
        const topic = {
            id: 'topic-2',
            name: 'Angular',
            description: 'Frontend work',
            keywords: ['angular'],
            excludedTerms: ['wordpress'],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.updateTopic.mockReturnValue(
            of({
                ...topic,
                keywords: ['angular', 'rxjs'],
                excludedTerms: ['wordpress', 'php'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS],
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        const component = fixture.componentInstance;
        component.editTopic(topic);
        component.topicForm.keywords = 'angular, rxjs';
        component.topicForm.excludedTerms = 'wordpress, php';
        component.topicForm.discoveryIntent = LeadTopicDiscoveryIntent.SERVICE_BUYERS;
        component.topicForm.sources = [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS];
        component.topicForm.googleMapsCities = '';
        component.topicForm.googleMapsTypes = '';

        component.submitTopic();

        expect(leadsServiceStub.updateTopic).toHaveBeenCalledWith('topic-2', {
            name: 'Angular',
            description: 'Frontend work',
            keywords: ['angular', 'rxjs'],
            excludedTerms: ['wordpress', 'php'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.REMOTE_OK, LeadDiscoverySource.HIMALAYAS],
            enabled: true,
        });
        expect(leadsServiceStub.runTopicDiscovery).not.toHaveBeenCalled();
    });

    it('shows an error when manual discovery fails', () => {
        const topic = {
            id: 'topic-3',
            name: 'Node',
            description: '',
            keywords: ['node'],
            excludedTerms: [],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.runTopicDiscovery.mockReturnValue(
            throwError(() => new Error('boom'))
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.runDiscovery(topic);

        expect(fixture.componentInstance.actionError).toContain('Unable to run discovery');
    });

    it('stores discovery diagnostics after a successful run', () => {
        const topic = {
            id: 'topic-4',
            name: 'Node',
            description: '',
            keywords: ['node'],
            excludedTerms: [],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.runTopicDiscovery.mockReturnValue(
            of({
                topicId: 'topic-4',
                linkedLeadCount: 2,
                addedCount: 2,
                removedCount: 0,
                queued: false,
                status: 'completed',
                message: 'Discovery matched 2 candidate leads.',
                providerResults: [
                    {
                        providerName: 'remoteok',
                        candidateCount: 2,
                        queries: ['remoteok jobs node'],
                        warnings: [],
                    },
                ],
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.runDiscovery(topic);

        expect(fixture.componentInstance.getDiscoveryResult(topic.id)).toEqual(
            expect.objectContaining({
                topicId: 'topic-4',
                status: 'completed',
                message: 'Discovery matched 2 candidate leads.',
            })
        );
    });

    it('requires at least one source before saving a topic', () => {
        leadsServiceStub.createTopic.mockReturnValue(of({}));

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm = {
            name: 'React',
            description: '',
            keywords: 'react',
            excludedTerms: '',
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [],
            googleMapsCities: '',
            googleMapsTypes: '',
            enabled: true,
        };

        fixture.componentInstance.submitTopic();

        expect(leadsServiceStub.createTopic).not.toHaveBeenCalled();
        expect(fixture.componentInstance.actionError).toContain('Select at least one source');
    });

    it('requires Google Maps cities and business types before saving a Google Maps topic', () => {
        leadsServiceStub.createTopic.mockReturnValue(of({}));

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm = {
            name: 'Savannah Local',
            description: '',
            keywords: 'restaurants',
            excludedTerms: '',
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: '',
            googleMapsTypes: '',
            enabled: true,
        };

        fixture.componentInstance.submitTopic();

        expect(leadsServiceStub.createTopic).not.toHaveBeenCalled();
        expect(fixture.componentInstance.actionError).toContain('Enter at least one Google Maps city');

        fixture.componentInstance.topicForm.googleMapsCities = 'Savannah, GA';
        fixture.componentInstance.submitTopic();

        expect(leadsServiceStub.createTopic).not.toHaveBeenCalled();
        expect(fixture.componentInstance.actionError).toContain('Enter at least one Google Maps business type');
    });

    it('includes Google Maps fields when saving a Google Maps topic', () => {
        leadsServiceStub.createTopic.mockReturnValue(
            of({
                id: 'topic-local',
                name: 'Savannah Local',
                description: '',
                keywords: ['restaurants'],
                excludedTerms: ['wordpress', 'php'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.GOOGLE_MAPS],
                googleMapsCities: ['Savannah, GA'],
                googleMapsTypes: ['restaurants'],
                googleMapsLocation: 'Savannah, GA',
                googleMapsRadiusMiles: 25,
                enabled: true,
                leadCount: 0,
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm = {
            name: 'Savannah Local',
            description: '',
            keywords: 'restaurants',
            excludedTerms: 'wordpress, php',
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: 'Savannah, GA',
            googleMapsTypes: 'restaurants',
            googleMapsLocation: 'Savannah, GA',
            googleMapsRadiusMiles: 25,
            enabled: true,
        };

        fixture.componentInstance.submitTopic();

        expect(leadsServiceStub.createTopic).toHaveBeenCalledWith({
            name: 'Savannah Local',
            description: '',
            keywords: ['restaurants'],
            excludedTerms: ['wordpress', 'php'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['restaurants'],
            googleMapsLocation: 'Savannah, GA',
            googleMapsRadiusMiles: 25,
            enabled: true,
        });
    });

    it('commits a selected Google Maps city as a chip-backed value', () => {
        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.applyGoogleMapsCitySuggestion({
            description: 'Savannah, GA, USA',
            primaryText: 'Savannah',
            secondaryText: 'GA, USA',
            placeId: 'place-1',
        });

        expect(fixture.componentInstance.selectedGoogleMapsCities).toEqual([
            'Savannah, GA, USA',
        ]);
        expect(fixture.componentInstance.googleMapsCityInput).toBe('');
    });

    it('deletes a topic through the service', () => {
        const topic = {
            id: 'topic-delete',
            name: 'Delete Me',
            description: '',
            keywords: ['react'],
            excludedTerms: [],
            discoveryIntent: LeadTopicDiscoveryIntent.JOB_OPENINGS,
            sources: [LeadDiscoverySource.REMOTE_OK],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.deleteTopic.mockReturnValue(of(undefined));
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.deleteTopic(topic as any);

        expect(leadsServiceStub.deleteTopic).toHaveBeenCalledWith('topic-delete');
    });

    it('applies a Maps suggestion to the last city token', () => {
        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm.googleMapsCities = 'Atlanta, GA, ';
        fixture.componentInstance.applyGoogleMapsCitySuggestion({
            description: 'Savannah, GA, USA',
            primaryText: 'Savannah',
            secondaryText: 'GA, USA',
            placeId: 'place-1',
        });

        expect(fixture.componentInstance.topicForm.googleMapsCities).toBe(
            'Atlanta, GA; Savannah, GA, USA'
        );
    });

    it('allows service-buyer topics to save without positive keywords when google maps inputs are present', () => {
        leadsServiceStub.createTopic.mockReturnValue(
            of({
                id: 'topic-service-buyers',
                name: 'Dental Offices',
                description: 'Local website prospects',
                keywords: [],
                excludedTerms: ['wordpress'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.GOOGLE_MAPS],
                googleMapsCities: ['Savannah, GA'],
                googleMapsTypes: ['dental office'],
                googleMapsLocation: 'Savannah, GA',
                googleMapsRadiusMiles: 25,
                enabled: true,
                leadCount: 0,
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm = {
            name: 'Dental Offices',
            description: 'Local website prospects',
            keywords: '',
            excludedTerms: 'wordpress',
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: 'Savannah, GA',
            googleMapsTypes: 'dental office',
            googleMapsLocation: 'Savannah, GA',
            googleMapsRadiusMiles: 25,
            enabled: true,
        };

        fixture.componentInstance.submitTopic();

        expect(leadsServiceStub.createTopic).toHaveBeenCalledWith({
            name: 'Dental Offices',
            description: 'Local website prospects',
            keywords: [],
            excludedTerms: ['wordpress'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['dental office'],
            googleMapsLocation: 'Savannah, GA',
            googleMapsRadiusMiles: 25,
            enabled: true,
        });
    });

    it('shows service-buyer help text when google maps is selected for local business discovery', () => {
        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.openAddForm();
        fixture.componentInstance.topicForm.sources = [LeadDiscoverySource.GOOGLE_MAPS];
        fixture.componentInstance.topicForm.discoveryIntent = LeadTopicDiscoveryIntent.SERVICE_BUYERS;
        fixture.detectChanges();

        const hints = fixture.debugElement.queryAll(By.css('.form-hint'));
        const hintText = hints.map((node) => node.nativeElement.textContent).join(' ');

        expect(hintText).toContain('local businesses by category');
        expect(hintText).toContain('not job postings');
    });

    it('does not render the guided setup banner on the topics screen', () => {
        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        const banner = fixture.debugElement.query(By.css('.topics-guidance'));

        expect(banner).toBeNull();
    });

    it('shows configured intent and exclusions on the topic card', () => {
        leadsServiceStub.getTopics.mockReturnValue(of([
            {
                id: 'topic-5',
                name: 'Dental Offices',
                description: 'Local buyers',
                keywords: ['react'],
                excludedTerms: ['wordpress', 'php'],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.GOOGLE_MAPS],
                googleMapsCities: ['Savannah, GA'],
                googleMapsTypes: ['dental office'],
                enabled: true,
                leadCount: 3,
            },
        ]));

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        const cardText = fixture.nativeElement.textContent;

        expect(cardText).toContain('Service Buyers');
        expect(cardText).toContain('Exclude: wordpress');
        expect(cardText).toContain('Exclude: php');
    });

    it('renders actionable provider diagnostics from discovery results', () => {
        const topic = {
            id: 'topic-6',
            name: 'Dental Offices',
            description: 'Local buyers',
            keywords: ['react'],
            excludedTerms: ['wordpress'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['dental office'],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.runTopicDiscovery.mockReturnValue(
            of({
                topicId: 'topic-6',
                linkedLeadCount: 0,
                addedCount: 0,
                removedCount: 0,
                queued: false,
                status: 'completed',
                message: 'No matching leads were found. Diagnostics: Google Maps discovery requires an API key.',
                providerResults: [
                    {
                        providerName: 'google-maps',
                        candidateCount: 0,
                        queries: [],
                        warnings: ['Google Maps discovery requires an API key.'],
                    },
                ],
            })
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.runDiscovery(topic);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent;
        expect(text).toContain('requires an API key');
    });

    it('renders a structured discovery summary with normalized provider issues', () => {
        const topic = {
            id: 'topic-structured',
            name: 'Dental Offices',
            description: 'Local buyers',
            keywords: ['react'],
            excludedTerms: ['wordpress'],
            discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
            sources: [LeadDiscoverySource.GOOGLE_MAPS],
            googleMapsCities: ['Savannah, GA'],
            googleMapsTypes: ['dental office'],
            enabled: true,
            leadCount: 0,
        };
        leadsServiceStub.getTopics.mockReturnValue(of([topic]));
        leadsServiceStub.runTopicDiscovery.mockReturnValue(
            of({
                topicId: 'topic-structured',
                linkedLeadCount: 0,
                addedCount: 0,
                removedCount: 0,
                queued: false,
                status: 'completed',
                message: 'No matching leads were found.',
                severity: 'warning',
                summaryTitle: 'Discovery needs attention',
                summaryBody: 'Google Maps could not run because the API key is missing.',
                actionItems: ['Add the Google Maps API key before running this topic again.'],
                diagnosticCounts: {
                    errors: 1,
                    warnings: 0,
                    providersWithIssues: 1,
                },
                providerResults: [
                    {
                        providerName: 'google-maps',
                        status: 'error',
                        candidateCount: 0,
                        queries: [],
                        warnings: ['Google Maps discovery requires an API key.'],
                        issues: [
                            {
                                type: 'missing-credentials',
                                severity: 'error',
                                summary: 'Missing API key',
                                detail: 'Google Maps discovery requires an API key.',
                                action: 'Add the Google Maps API key before running again.',
                            },
                        ],
                    },
                ],
            } as any)
        );

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        fixture.componentInstance.runDiscovery(topic);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent;
        expect(text).toContain('Discovery needs attention');
        expect(text).toContain('Google Maps could not run because the API key is missing.');
        expect(text).toContain('Missing API key');
        expect(text).toContain('Add the Google Maps API key before running again.');
    });

    it('renders qualification summary metrics for each topic', () => {
        leadsServiceStub.getTopics.mockReturnValue(of([
            {
                id: 'topic-qual',
                name: 'React buyers',
                description: 'Frontend consulting buyers',
                keywords: ['react'],
                excludedTerms: [],
                discoveryIntent: LeadTopicDiscoveryIntent.SERVICE_BUYERS,
                sources: [LeadDiscoverySource.CLUTCH],
                enabled: true,
                leadCount: 3,
                qualificationSummary: {
                    byClassification: {
                        'strong-match': 2,
                        review: 1,
                        'weak-match': 0,
                    },
                    averageRelevanceScore: 79,
                    averageDifficultyScore: 58,
                    averageUserFitScore: 81,
                    missingUserFitCount: 1,
                },
            },
        ]));

        const fixture = TestBed.createComponent(TopicsComponent);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent;
        expect(text).toContain('Strong match');
        expect(text).toContain('Avg relevance');
        expect(text).toContain('79');
    });
});
