import { TestBed } from '@angular/core/testing';
import { MarketingInsightsService } from './marketing-insights.service';

describe('MarketingInsightsService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [MarketingInsightsService],
    });
  });

  it('persists events and concept feedback into a reusable summary', () => {
    const service = TestBed.inject(MarketingInsightsService);

    service.logEvent({
      type: 'generation_requested',
      workspaceId: 'workspace-1',
    });
    service.logEvent({
      type: 'concept_selected',
      workspaceId: 'workspace-1',
      conceptId: 'concept-1',
    });
    service.logEvent({
      type: 'bundle_exported',
      workspaceId: 'workspace-1',
      conceptId: 'concept-1',
    });
    service.recordConceptFeedback({
      workspaceId: 'workspace-1',
      conceptId: 'concept-1',
      sentiment: 'positive',
      reason: 'strongest-direction',
    });

    expect(service.events().length).toBe(3);
    expect(service.feedback().length).toBe(1);
    expect(service.summary()).toEqual(
      expect.objectContaining({
        generationRuns: 1,
        conceptSelections: 1,
        exports: 1,
        positiveFeedback: 1,
        usefulnessRate: 1,
      })
    );
  });

  it('aggregates concept-level feedback by reason', () => {
    const service = TestBed.inject(MarketingInsightsService);

    service.recordConceptFeedback({
      workspaceId: 'workspace-1',
      conceptId: 'concept-9',
      sentiment: 'negative',
      reason: 'too-generic',
    });
    service.recordConceptFeedback({
      workspaceId: 'workspace-1',
      conceptId: 'concept-9',
      sentiment: 'negative',
      reason: 'too-generic',
    });
    service.recordConceptFeedback({
      workspaceId: 'workspace-1',
      conceptId: 'concept-9',
      sentiment: 'positive',
      reason: 'useful',
    });

    expect(service.feedbackSummaryForConcept('concept-9')).toEqual(
      expect.objectContaining({
        positive: 1,
        negative: 2,
        topReason: 'too-generic',
      })
    );
  });

  it('falls back when persisted insights payloads contain malformed json', () => {
    localStorage.setItem('signal-foundry-insights-events', '{');
    localStorage.setItem('signal-foundry-insights-feedback', '{');

    const service = TestBed.inject(MarketingInsightsService);

    expect(service.events()).toEqual([]);
    expect(service.feedback()).toEqual([]);
    expect(localStorage.getItem('signal-foundry-insights-events')).toBeNull();
    expect(localStorage.getItem('signal-foundry-insights-feedback')).toBeNull();
  });
});
