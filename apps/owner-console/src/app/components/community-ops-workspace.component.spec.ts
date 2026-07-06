import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { CommunityOpsWorkspaceComponent } from './community-ops-workspace.component';
import { CommunityService } from '../services/community.service';

describe('CommunityOpsWorkspaceComponent', () => {
  const communityService = {
    getCommunities: jest.fn(),
    getCities: jest.fn(),
    getCommunityMembers: jest.fn(),
    getCommunityManager: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    localStorage.clear();
    communityService.getCommunities.mockReturnValue(
      of([
        {
          id: 'community-1',
          name: 'Makers Guild',
          description: 'Collaborative local makers',
          memberCount: 2,
          joinPolicy: 'approval_required',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
        {
          id: 'community-2',
          name: 'Writers Circle',
          description: 'Weekly workshop',
          memberCount: 1,
          joinPolicy: 'public',
          createdAt: '2026-06-20T00:00:00.000Z',
        },
      ])
    );
    communityService.getCities.mockReturnValue(
      of([
        {
          id: 'city-1',
          name: 'Raleigh',
          description: 'Triangle market',
          localityType: 'city',
          city: 'Raleigh',
          adminArea: 'NC',
          population: 480000,
          createdAt: '2026-05-12T00:00:00.000Z',
        },
      ])
    );
    communityService.getCommunityMembers.mockImplementation(
      (communityId: string) =>
        of(
          communityId === 'community-1'
            ? [
                {
                  id: 'member-1',
                  userId: 'user-1',
                  profileId: 'profile-1',
                  role: 'moderator',
                  status: 'approved',
                  joinedAt: '2026-07-02T00:00:00.000Z',
                },
                {
                  id: 'member-2',
                  userId: 'user-2',
                  profileId: 'profile-2',
                  role: 'member',
                  status: 'approved',
                  joinedAt: '2026-07-03T00:00:00.000Z',
                },
              ]
            : [
                {
                  id: 'member-3',
                  userId: 'user-3',
                  profileId: 'profile-3',
                  role: 'member',
                  status: 'pending',
                  joinedAt: '2026-06-25T00:00:00.000Z',
                },
              ]
        )
    );
    communityService.getCommunityManager.mockImplementation(
      (communityId: string) =>
        of(
          communityId === 'community-1'
            ? {
                userId: 'user-1',
                profileId: 'profile-1',
              }
            : null
        )
    );

    await TestBed.configureTestingModule({
      imports: [CommunityOpsWorkspaceComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: communityService },
      ],
    }).compileComponents();
  });

  it('loads shared community ops metrics across communities, cities, and members', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    expect(component.summaryMetrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Communities', value: '2' }),
        expect.objectContaining({ label: 'Cities', value: '1' }),
        expect.objectContaining({ label: 'Member records', value: '3' }),
      ])
    );
    expect(component.selectedEntity?.id).toBe('community-2');
    expect(component.selectedEntity?.entityType).toBe('community');
  });

  it('surfaces member entities in the unified browser from day one', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.entityTypeFilter = 'member';
    component.applyFilters();

    expect(
      component.filteredEntities.map((entity: { id: string }) => entity.id)
    ).toEqual([
      'community-2:member-3',
      'community-1:member-2',
      'community-1:member-1',
    ]);
  });

  it('renders direct links into existing locality and membership flows', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1'
      )!
    );
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Manage Members');
    expect(text).toContain('Edit Community');
    expect(text).toContain('Moderation Streams');
  });

  it('persists operator notes per selected entity', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1'
      )!
    );
    component.noteDraft = 'Escalated after repeated manager vacancy.';

    component.saveNote();
    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1'
      )!
    );

    expect(component.activeNotes).toEqual([
      expect.objectContaining({
        body: 'Escalated after repeated manager vacancy.',
      }),
    ]);
  });

  it('tracks escalation history entries per entity', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.escalationDraft = 'Ownership gap';
    component.addEscalation('open');
    component.escalationDraft = 'Manager appointed';
    component.addEscalation('resolved');

    expect(
      component.activeEscalations.map(
        (entry: { status: string }) => entry.status
      )
    ).toEqual(['resolved', 'open']);
    expect(component.activeEscalations[0].summary).toBe('Manager appointed');
  });

  it('builds cross-entity pivots from a community into its member records', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1'
      )!
    );

    expect(
      component.relatedEntities.map((entity: { id: string }) => entity.id)
    ).toEqual(['community-1:member-2', 'community-1:member-1']);
  });

  it('lets operators pivot from a member back to the owning community', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1:member-2'
      )!
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Related entities');
    expect(fixture.nativeElement.textContent).toContain('Makers Guild');
  });

  it('selects a related entity directly from the shared workspace', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1:member-2'
      )!
    );
    component.selectEntity(component.relatedEntities[0]);

    expect(component.selectedEntity?.id).toBe('community-1');
  });

  it('promotes note and escalation pressure into the entity browser state', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.noteDraft = 'Needs locality escalation review.';
    component.saveNote();
    component.escalationDraft = 'Manager gap still unresolved';
    component.addEscalation('open');

    component.applyFilters();
    fixture.detectChanges();

    const updatedEntity = component.entities.find(
      (entity: { id: string }) => entity.id === 'community-2'
    );

    expect(updatedEntity).toEqual(
      expect.objectContaining({
        health: 'attention',
      })
    );
    expect(fixture.nativeElement.textContent).toContain('1 open escalation');
    expect(fixture.nativeElement.textContent).toContain('1 note');
  });

  it('builds scoped moderation handoff context from the selected entity', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-1:member-2'
      )!
    );

    expect(component.moderationContext()).toEqual({
      source: 'community-ops',
      entityType: 'member',
      entityId: 'community-1:member-2',
      communityId: 'community-1',
      communityName: 'Makers Guild',
      entityTitle: 'profile-2',
    });
  });

  it('creates a shared case for the selected entity and persists ownership', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.caseDraft = {
      title: 'Community leadership gap',
      summary: 'No manager is currently assigned to this community.',
      owner: 'ops-community',
    };

    component.createCase();

    expect(component.activeCase).toEqual(
      expect.objectContaining({
        title: 'Community leadership gap',
        owner: 'ops-community',
        status: 'open',
      })
    );
  });

  it('updates the shared case resolution state for the selected entity', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.caseDraft = {
      title: 'Community leadership gap',
      summary: 'No manager is currently assigned to this community.',
      owner: 'ops-community',
    };
    component.createCase();
    component.updateCaseStatus('resolved');

    expect(component.activeCase).toEqual(
      expect.objectContaining({
        status: 'resolved',
      })
    );
  });

  it('shows case pressure in the entity browser once a case exists', () => {
    const fixture = TestBed.createComponent(CommunityOpsWorkspaceComponent);
    fixture.detectChanges();
    const component: CommunityOpsWorkspaceComponent = fixture.componentInstance;

    component.selectEntity(
      component.entities.find(
        (entity: { id: string }) => entity.id === 'community-2'
      )!
    );
    component.caseDraft = {
      title: 'Community leadership gap',
      summary: 'No manager is currently assigned to this community.',
      owner: 'ops-community',
    };
    component.createCase();
    component.applyFilters();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 open case');
  });
});
