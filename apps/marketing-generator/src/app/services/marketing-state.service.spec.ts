import { TestBed } from '@angular/core/testing';
import { MarketingStateService } from './marketing-state.service';

describe('MarketingStateService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarketingStateService],
    });
  });

  it('provides default deliverables, brand profile, and image generation settings', () => {
    const service = TestBed.inject(MarketingStateService);

    expect(service.request().deliverables.length).toBeGreaterThan(0);
    expect(service.request().deliverables[0]).toEqual(
      expect.objectContaining({
        type: 'flyer',
        formatId: expect.any(String),
        quantity: 1,
      })
    );
    expect(service.request().generateImages).toBe(true);
    expect(service.request().brand.businessName).toBe('');
    expect(service.request().visualDirection).toBe('');
  });

  it('merges nested custom app updates through patchRequest', () => {
    const service = TestBed.inject(MarketingStateService);

    service.patchRequest({
      customApp: {
        name: 'Atlas Room',
        category: '',
        summary: '',
        features: '',
        differentiators: '',
        primaryGoal: '',
      },
    });

    expect(service.request().customApp.name).toBe('Atlas Room');
    expect(service.request().selectedOfferingId).toBe('video-client');
  });

  it('merges nested brand updates through patchRequest', () => {
    const service = TestBed.inject(MarketingStateService);

    service.patchRequest({
      brand: {
        businessName: 'Atlas Room',
        tagline: '',
        primaryColor: '#1d4ed8',
        secondaryColor: '',
        accentColor: '',
        visualStyle: '',
        logoUrl: '',
      },
    });

    expect(service.request().brand.businessName).toBe('Atlas Room');
    expect(service.request().brand.primaryColor).toBe('#1d4ed8');
    expect(service.request().audienceId).toBe('creators');
  });

  it('creates, renames, and duplicates persisted workspaces', () => {
    const service = TestBed.inject(MarketingStateService);

    service.createWorkspace('Launch Sprint');
    service.renameCurrentWorkspace('Launch Sprint v2');
    service.duplicateCurrentWorkspace();

    expect(service.workspaces().length).toBeGreaterThanOrEqual(2);
    expect(service.currentWorkspace()?.name).toBe('Launch Sprint v2');
    expect(
      service.workspaces().some((workspace) => workspace.name.includes('Copy'))
    ).toBe(true);
  });

  it('switches active workspace and restores the request snapshot', () => {
    const service = TestBed.inject(MarketingStateService);

    service.createWorkspace('Workspace A');
    service.patchRequest({ audienceId: 'community-operators' });
    const workspaceAId = service.currentWorkspace()!.id;

    service.createWorkspace('Workspace B');
    service.patchRequest({ audienceId: 'technical-buyers' });
    const workspaceBId = service.currentWorkspace()!.id;

    service.selectWorkspace(workspaceAId);
    expect(service.request().audienceId).toBe('community-operators');

    service.selectWorkspace(workspaceBId);
    expect(service.request().audienceId).toBe('technical-buyers');
  });

  it('saves and restores workspace versions with decision summaries', () => {
    const service = TestBed.inject(MarketingStateService);

    service.createWorkspace('Decision Flow');
    service.patchRequest({ audienceId: 'community-operators' });
    service.setDecisionSummary('Winner chosen: community angle.');
    service.saveWorkspaceVersion('Community winner');

    service.patchRequest({ audienceId: 'technical-buyers' });
    const savedVersion = service
      .currentWorkspace()!
      .versions.find((version) => version.name === 'Community winner');

    expect(savedVersion).toBeTruthy();

    service.restoreWorkspaceVersion(savedVersion!.id);

    expect(service.request().audienceId).toBe('community-operators');
    expect(service.currentWorkspace()?.decisionSummary).toBe(
      'Winner chosen: community angle.'
    );
  });
});
