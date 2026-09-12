import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { WorkspaceDiscoveryStore } from '@optimistic-tanuki/app-config-data-access';
import { BlogAuthoringShellComponent } from '@optimistic-tanuki/blogging-ui';
import { OwnerWorkspaceAuthoringComponent } from './owner-workspace-authoring.component';

const workspace = {
  workspaceId: 'workspace-1',
  kind: 'business-site' as const,
  slug: 'north-star',
  displayName: 'North Star',
  appScope: 'configurable-client',
  status: 'active' as const,
  membershipRole: 'owner' as const,
  membershipStatus: 'active' as const,
};

describe('OwnerWorkspaceAuthoringComponent', () => {
  let fixture: ComponentFixture<OwnerWorkspaceAuthoringComponent>;
  let store: {
    workspaces: jest.Mock;
    loading: jest.Mock;
    error: jest.Mock;
    load: jest.Mock;
  };
  let routeParams: Subject<ParamMap>;

  beforeEach(async () => {
    store = {
      workspaces: jest.fn().mockReturnValue([workspace]),
      loading: jest.fn().mockReturnValue(false),
      error: jest.fn().mockReturnValue(null),
      load: jest.fn(),
    };
    routeParams = new Subject<ParamMap>();
    await TestBed.configureTestingModule({
      imports: [OwnerWorkspaceAuthoringComponent],
      providers: [
        provideHttpClient(),
        { provide: WorkspaceDiscoveryStore, useValue: store },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
            snapshot: {
              paramMap: new Map([['workspaceSlug', 'north-star']]),
              queryParamMap: new Map(),
            },
          },
        },
        { provide: Router, useValue: { navigateByUrl: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerWorkspaceAuthoringComponent);
    fixture.detectChanges();
  });

  it('resolves the server-discovered workspace and composes the reusable blog shell', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('North Star');
    expect(host.querySelector('ot-blog-authoring-shell')).not.toBeNull();
    expect(
      host.querySelector('a[href="/owner/workspace/north-star/author/blog"]')
    ).not.toBeNull();
  });

  it('passes the resolved workspace app scope to the reusable blog shell', () => {
    const shell = fixture.debugElement.query(
      By.directive(BlogAuthoringShellComponent)
    );

    expect(shell.componentInstance.appScope).toBe('configurable-client');
  });

  it('marks forum and social authoring unavailable for a community workspace', () => {
    store.workspaces.mockReturnValue([{ ...workspace, kind: 'community' }]);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('ot-forum-authoring-shell')).toBeNull();
    expect(host.querySelector('ot-social-authoring-shell')).toBeNull();
    expect(
      host.querySelector('a[href="/owner/workspace/north-star/author/blog"]')
    ).toBeNull();
    expect(host.textContent).toContain('currently unavailable');
  });

  it('switches workspace and feature context from route params without retaining the prior shell', () => {
    routeParams.next(
      new Map([
        ['workspaceSlug', 'south-star'],
        ['feature', 'blog'],
      ]) as unknown as ParamMap
    );
    store.workspaces.mockReturnValue([
      { ...workspace, slug: 'south-star', displayName: 'South Star' },
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.slug).toBe('south-star');
    expect(fixture.componentInstance.feature).toBe('blog');
    expect(fixture.nativeElement.textContent).toContain('South Star');
    expect(
      fixture.nativeElement.querySelector('ot-blog-authoring-shell')
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('North Star');
  });

  it('shows an unavailable state for a foreign or non-owner workspace', () => {
    store.workspaces.mockReturnValue([
      { ...workspace, slug: 'other', membershipRole: 'member' },
    ]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Authoring unavailable'
    );
    expect(
      fixture.nativeElement.querySelector('ot-blog-authoring-shell')
    ).toBeNull();
  });
});
