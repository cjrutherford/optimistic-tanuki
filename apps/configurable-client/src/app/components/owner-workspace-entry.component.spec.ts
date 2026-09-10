import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { WorkspaceDiscoveryStore } from '@optimistic-tanuki/app-config-data-access';
import { OwnerWorkspaceEntryComponent } from './owner-workspace-entry.component';

const ownedWorkspace = {
  workspaceId: 'workspace-1',
  kind: 'community' as const,
  slug: 'north-star',
  displayName: 'North Star',
  appScope: 'configurable-client',
  status: 'active' as const,
  membershipRole: 'owner' as const,
  membershipStatus: 'active' as const,
};

describe('OwnerWorkspaceEntryComponent', () => {
  let fixture: ComponentFixture<OwnerWorkspaceEntryComponent>;
  let store: {
    workspaces: jest.Mock;
    loading: jest.Mock;
    error: jest.Mock;
    load: jest.Mock;
  };
  let router: { navigateByUrl: jest.Mock };

  beforeEach(async () => {
    store = {
      workspaces: jest.fn().mockReturnValue([ownedWorkspace]),
      loading: jest.fn().mockReturnValue(false),
      error: jest.fn().mockReturnValue(null),
      load: jest.fn(),
    };
    router = { navigateByUrl: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [OwnerWorkspaceEntryComponent],
      providers: [
        { provide: WorkspaceDiscoveryStore, useValue: store },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerWorkspaceEntryComponent);
    fixture.detectChanges();
  });

  it('loads the shared discovery store and navigates an owned workspace to its scoped dashboard', () => {
    expect(store.load).toHaveBeenCalled();
    const button = fixture.nativeElement.querySelector(
      '[data-workspace-slug="north-star"]'
    ) as HTMLButtonElement;
    button.click();
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/owner/workspace/north-star'
    );
  });

  it.each([
    ['loading', 'Finding your workspaces'],
    ['error', 'We could not load your workspaces'],
    ['empty', 'No owned workspaces yet'],
  ] as const)('renders the %s picker state', (state, copy) => {
    store.loading.mockReturnValue(state === 'loading');
    store.error.mockReturnValue(
      state === 'error' ? 'We could not load your workspaces' : null
    );
    store.workspaces.mockReturnValue(state === 'empty' ? [] : [ownedWorkspace]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(copy);
  });

  it('filters out non-owner, inactive, and incomplete workspaces instead of offering unsafe choices', () => {
    store.workspaces.mockReturnValue([
      ownedWorkspace,
      { ...ownedWorkspace, slug: 'member-space', membershipRole: 'member' },
      { ...ownedWorkspace, slug: 'paused-space', status: 'suspended' },
      { ...ownedWorkspace, slug: 'incomplete-space', workspaceId: '' },
    ]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector('[data-workspace-slug="north-star"]')
    ).not.toBeNull();
    expect(
      host.querySelector('[data-workspace-slug="member-space"]')
    ).toBeNull();
    expect(
      host.querySelector('[data-workspace-slug="paused-space"]')
    ).toBeNull();
    expect(
      host.querySelector('[data-workspace-slug="incomplete-space"]')
    ).toBeNull();
  });
});
