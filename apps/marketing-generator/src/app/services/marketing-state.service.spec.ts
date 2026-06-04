import { TestBed } from '@angular/core/testing';
import { MarketingStateService } from './marketing-state.service';

describe('MarketingStateService', () => {
  beforeEach(() => {
    localStorage.clear();
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

  it('falls back to the first stored workspace when the current workspace id is missing', () => {
    localStorage.setItem(
      'signal-foundry-workspaces',
      JSON.stringify([
        {
          id: 'workspace-a',
          name: 'Workspace A',
          createdAt: '2026-05-27T00:00:00.000Z',
          updatedAt: '2026-05-27T00:00:00.000Z',
          request: {
            offeringKind: 'preset-app',
            selectedOfferingId: 'video-client',
            customApp: {
              name: '',
              category: '',
              summary: '',
              features: '',
              differentiators: '',
              primaryGoal: '',
            },
            audienceId: 'community-operators',
            campaignIntent: 'awareness',
            channel: 'web',
            secondaryChannels: [],
            tone: 'editorial',
            includeAiPolish: true,
            deliverables: [
              { type: 'flyer', formatId: 'flyer-letter', quantity: 1 },
            ],
            brand: {
              businessName: '',
              tagline: '',
              primaryColor: '#f59e0b',
              secondaryColor: '#111827',
              accentColor: '#34d399',
              visualStyle: '',
              logoUrl: '',
            },
            visualDirection: '',
            generateImages: true,
          },
          concepts: [],
          selectedConceptId: '',
          versions: [],
        },
      ])
    );

    const service = TestBed.inject(MarketingStateService);

    expect(service.currentWorkspaceId()).toBe('workspace-a');
    expect(
      JSON.parse(
        localStorage.getItem('signal-foundry-current-workspace') ?? '""'
      )
    ).toBe('workspace-a');
    expect(service.request().audienceId).toBe('community-operators');
  });

  it('falls back when stored workspace or concept state contains malformed json', () => {
    localStorage.setItem('signal-foundry-workspaces', '{');
    localStorage.setItem('signal-foundry-concepts', '{');

    const service = TestBed.inject(MarketingStateService);

    expect(service.workspaces().length).toBe(1);
    expect(service.concepts()).toEqual([]);
    expect(localStorage.getItem('signal-foundry-workspaces')).not.toBe('{');
    expect(localStorage.getItem('signal-foundry-concepts')).toBeNull();
  });

  it('exposes operator-facing workspace status for shell surfaces', () => {
    const service = TestBed.inject(MarketingStateService);

    service.createWorkspace('Launch Sprint');
    service.renameCurrentWorkspace('Launch Sprint v2');

    expect(service.workspaceStatus().storageLabel).toBe('Browser storage only');
    expect(service.workspaceStatus().currentWorkspaceName).toBe(
      'Launch Sprint v2'
    );
    expect(service.workspaceStatus().workspaceCount).toBeGreaterThan(0);
    expect(service.workspaceStatus().currentVersionCount).toBeGreaterThan(0);
    expect(service.workspaceStatus().lastSavedAt).toEqual(expect.any(String));
  });
});
