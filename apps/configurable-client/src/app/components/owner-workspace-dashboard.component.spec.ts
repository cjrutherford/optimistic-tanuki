import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { of, Subject, throwError } from 'rxjs';
import {
  OwnerWorkspaceDashboardStore,
  WorkspaceDiscoveryStore,
} from '@optimistic-tanuki/app-config-data-access';
import type { OwnerWorkspaceDashboard } from '@optimistic-tanuki/app-config-data-access';
import { OwnerWorkspaceDashboardComponent } from './owner-workspace-dashboard.component';

const dashboard: OwnerWorkspaceDashboard = {
  workspace: {
    id: 'workspace-1',
    slug: 'north-star',
    name: 'North Star',
    status: 'active',
  },
  app: { id: 'app-1', name: 'North Star Client', scope: 'configurable-client' },
  membership: {
    role: 'owner',
    status: 'active',
    canEdit: true,
    canPublish: true,
  },
  configuration: {
    id: 'config-1',
    revision: 7,
    active: true,
    releaseStatus: 'draft',
    updatedAt: new Date('2026-08-31T14:00:00Z'),
  },
  links: {
    preview: '/app/north-star-client?workspaceSlug=north-star',
    edit: '/owner/workspace/north-star/config/config-1',
  },
};

describe('OwnerWorkspaceDashboardComponent', () => {
  let fixture: ComponentFixture<OwnerWorkspaceDashboardComponent>;
  let store: {
    dashboard: jest.Mock;
    state: jest.Mock;
    error: jest.Mock;
    publishError: jest.Mock;
    publishing: jest.Mock;
    rollbackError: jest.Mock;
    rollingBack: jest.Mock;
    load: jest.Mock;
    retry: jest.Mock;
    publish: jest.Mock;
    rollback: jest.Mock;
  };
  let discoveryStore: { workspaces: jest.Mock; load: jest.Mock };
  let routeParams: Subject<ParamMap>;
  const router = {
    events: of(),
    navigateByUrl: jest.fn(),
    createUrlTree: jest.fn((commands: unknown) => commands),
    serializeUrl: jest.fn((tree: unknown) =>
      Array.isArray(tree) ? tree.join('/') : String(tree)
    ),
  };

  beforeEach(async () => {
    routeParams = new Subject<ParamMap>();
    store = {
      dashboard: jest.fn().mockReturnValue(dashboard),
      state: jest.fn().mockReturnValue('ready'),
      error: jest.fn().mockReturnValue(null),
      publishError: jest.fn().mockReturnValue(null),
      publishing: jest.fn().mockReturnValue(false),
      rollbackError: jest.fn().mockReturnValue(null),
      rollingBack: jest.fn().mockReturnValue(false),
      load: jest.fn(),
      retry: jest.fn(),
      publish: jest.fn().mockReturnValue(of(dashboard)),
      rollback: jest.fn().mockReturnValue(of(dashboard)),
    };
    discoveryStore = {
      workspaces: jest.fn().mockReturnValue([
        {
          workspaceId: 'workspace-1',
          kind: 'business-site',
          slug: 'north-star',
          displayName: 'North Star',
          appScope: 'configurable-client',
          status: 'active',
          membershipRole: 'owner',
          membershipStatus: 'active',
        },
      ]),
      load: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [OwnerWorkspaceDashboardComponent],
      providers: [
        { provide: OwnerWorkspaceDashboardStore, useValue: store },
        { provide: WorkspaceDiscoveryStore, useValue: discoveryStore },
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
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnerWorkspaceDashboardComponent);
    fixture.detectChanges();
  });

  it('uses Angular router links for internal owner actions so editor guards receive in-app navigation', () => {
    const source = readFileSync(
      resolve(__dirname, 'owner-workspace-dashboard.component.ts'),
      'utf8'
    );

    expect(source).toContain('[routerLink]="current.links.edit"');
    expect(source).toContain('[routerLink]="authorHref(current)"');
  });

  it('keeps the preview doorway query in the browser URL instead of routing it as a path command', () => {
    const source = readFileSync(
      resolve(__dirname, 'owner-workspace-dashboard.component.ts'),
      'utf8'
    );

    expect(source).toContain('[href]="current.links.preview"');
    expect(source).not.toContain('[routerLink]="current.links.preview"');
  });

  it('loads the route workspace and renders authoritative identity, role, revision, and actions', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(store.load).toHaveBeenCalledWith('north-star');
    expect(host.textContent).toContain('North Star');
    expect(host.textContent).toContain('North Star Client');
    expect(host.textContent).toContain('Owner');
    expect(host.textContent).toContain('Draft');
    expect(host.textContent).toContain('Revision');
    expect(host.textContent).toContain('7');
    expect(
      host.querySelector(
        'a[href="/owner/workspace/north-star/config/config-1"]'
      )
    ).not.toBeNull();
    expect(
      host.querySelector(
        'a[href="/app/north-star-client?workspaceSlug=north-star"]'
      )
    ).not.toBeNull();
    expect(host.querySelector('button[data-action="publish"]')).not.toBeNull();
  });

  it('renders release history and confirms a selected rollback through the store', () => {
    store.dashboard.mockReturnValue({
      ...dashboard,
      configuration: {
        ...dashboard.configuration,
        publishedVersion: 2,
        releaseHistory: [
          { version: 1, action: 'publish', releaseNotes: 'Initial launch' },
          { version: 2, action: 'publish', releaseNotes: 'Current launch' },
        ],
      },
    });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Published version 2'
    );
    expect(
      fixture.nativeElement.querySelector(
        '[data-action="rollback"][data-version="1"]'
      )
    ).not.toBeNull();
    (
      fixture.nativeElement.querySelector(
        '[data-action="rollback"][data-version="1"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-action="confirm-rollback"]')
    ).not.toBeNull();
    (
      fixture.nativeElement.querySelector(
        '[data-action="confirm-rollback"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(store.rollback).toHaveBeenCalledWith(1, 'Restore release v1');
  });

  it('reloads and clears publish context when the route workspace changes', () => {
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    routeParams.next(
      new Map([['workspaceSlug', 'south-star']]) as unknown as ParamMap
    );
    fixture.detectChanges();

    expect(store.load).toHaveBeenLastCalledWith('south-star');
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.componentInstance.publishSuccess).toBeNull();
  });

  it.each([
    ['loading', 'Loading your workspace', 'draft'],
    ['ready', 'Draft', 'draft'],
    ['ready', 'Published', 'published'],
    ['ready', 'Changes pending', 'pending'],
    ['ready', 'Rolled back', 'rolled-back'],
    ['empty', 'No configuration yet', 'draft'],
    ['unavailable', 'Workspace unavailable', 'draft'],
    ['error', 'We could not load this workspace', 'draft'],
  ] as const)(
    'renders the %s state and release label %s',
    (state, copy, releaseStatus) => {
      store.state.mockReturnValue(state);
      store.dashboard.mockReturnValue(
        state === 'ready'
          ? {
              ...dashboard,
              configuration: { ...dashboard.configuration, releaseStatus },
            }
          : null
      );
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        copy
      );
      if (state === 'ready' && releaseStatus === 'draft') {
        expect((fixture.nativeElement as HTMLElement).textContent).toContain(
          'Changes saved as draft'
        );
      }
      if (state === 'error' || state === 'unavailable') {
        expect(
          fixture.nativeElement.querySelector('button[data-action="retry"]')
        ).not.toBeNull();
      }
    }
  );

  it('gates owner actions when the resolved server capability is false', () => {
    store.dashboard.mockReturnValue({
      ...dashboard,
      membership: {
        ...dashboard.membership,
        canEdit: false,
        canPublish: false,
      },
    });
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(
      host.querySelector(
        'a[href="/owner/workspace/north-star/config/config-1"]'
      )
    ).toBeNull();
    expect(host.querySelector('button[data-action="publish"]')).toBeNull();
    expect(host.textContent).toContain('Owner actions are unavailable');
  });

  it('hides authoring when the discovered workspace has no functional authoring capability', () => {
    discoveryStore.workspaces.mockReturnValue([
      {
        workspaceId: 'workspace-1',
        kind: 'community',
        slug: 'north-star',
        displayName: 'North Star',
        appScope: 'configurable-client',
        status: 'active',
        membershipRole: 'owner',
        membershipStatus: 'active',
      },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        'a[href="/owner/workspace/north-star/author"]'
      )
    ).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Content authoring is unavailable'
    );
  });

  it('requires confirmation naming the app, workspace, and revision before publishing', () => {
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('[role="dialog"]')?.textContent).toEqual(
      expect.stringContaining('North Star Client')
    );
    expect(host.querySelector('[role="dialog"]')?.textContent).toEqual(
      expect.stringContaining('North Star')
    );
    expect(host.querySelector('[role="dialog"]')?.textContent).toEqual(
      expect.stringContaining('revision 7')
    );
  });

  it('keeps the publish modal description ID unique and referenced by the dialog', () => {
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('#publish-description')).toHaveLength(1);
    expect(
      host.querySelector('[role="dialog"]')?.getAttribute('aria-describedby')
    ).toBe('publish-description');
  });

  it('cancels confirmation and prevents duplicate publish submissions while in progress', () => {
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '.dialog-actions button:not([data-action="confirm-publish"])'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(store.publish).not.toHaveBeenCalled();
  });

  it('shows server-confirmed revision and timestamp after a successful publish', () => {
    const published = {
      ...dashboard,
      configuration: {
        ...dashboard.configuration,
        revision: 8,
        releaseStatus: 'published' as const,
        updatedAt: new Date('2026-08-31T16:45:00Z'),
      },
    };
    store.publish.mockReturnValue(of(published));
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const success = fixture.nativeElement.querySelector(
      '[data-server-confirmed="true"]'
    ) as HTMLElement;
    expect(success).not.toBeNull();
    expect(success.textContent).toContain('Published revision 8');
    expect(success.textContent).toContain('Aug 31, 2026 · 12:45 PM');
  });

  it('reopens the failed publish with the same workspace and draft revision context', () => {
    store.publish.mockReturnValue(
      throwError(() => new Error('Release service unavailable'))
    );
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="retry-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    const retryDialog = fixture.nativeElement.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const retryContext = retryDialog.querySelector(
      '[data-config-id]'
    ) as HTMLElement;
    expect(retryContext.dataset.configId).toBe('config-1');
    expect(retryContext.dataset.workspaceSlug).toBe('north-star');
    expect(retryContext.dataset.revision).toBe('7');
    expect(retryDialog.textContent).toEqual(
      expect.stringContaining('North Star Client')
    );
    expect(retryDialog.textContent).toEqual(
      expect.stringContaining('North Star')
    );
    expect(retryDialog.textContent).toEqual(
      expect.stringContaining('revision 7')
    );
    (
      retryDialog.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(store.publish).toHaveBeenCalledTimes(2);
    const retryAttempt = fixture.nativeElement.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const retryAttemptContext = retryAttempt.querySelector(
      '[data-config-id]'
    ) as HTMLElement;
    expect(retryAttemptContext.dataset.configId).toBe('config-1');
    expect(retryAttemptContext.dataset.workspaceSlug).toBe('north-star');
    expect(retryAttemptContext.dataset.revision).toBe('7');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Draft'
    );
  });

  it('prevents duplicate publish submissions while in progress', () => {
    const response = new Subject<OwnerWorkspaceDashboard>();
    store.publish.mockReturnValue(response.asObservable());
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(store.publish).toHaveBeenCalledTimes(1);
    expect(
      (
        fixture.nativeElement.querySelector(
          'button[data-action="confirm-publish"]'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('[role="status"]') as HTMLElement)
        ?.textContent
    ).toContain('Publishing');
  });

  it('cancels an in-flight publish when the component is destroyed', () => {
    const response = new Subject<OwnerWorkspaceDashboard>();
    store.publish.mockReturnValue(response.asObservable());
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    fixture.destroy();
    response.next({
      ...dashboard,
      configuration: { ...dashboard.configuration, revision: 8 },
    });

    expect(fixture.componentInstance.publishSuccess).toBeNull();
  });

  it('uses the shared modal keyboard contract and restores focus to its trigger', () => {
    const trigger = fixture.nativeElement.querySelector(
      'button[data-action="publish"]'
    ) as HTMLButtonElement;
    trigger.focus();
    trigger.click();
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    expect(dialog).not.toBeNull();
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('contains Tab focus within the shared publish modal', async () => {
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 120));

    const dialog = fixture.nativeElement.querySelector(
      '[role="dialog"]'
    ) as HTMLElement;
    const buttons = dialog.querySelectorAll('button');
    const confirm = buttons[buttons.length - 1] as HTMLButtonElement;
    const cancel = buttons[0] as HTMLButtonElement;
    confirm.focus();
    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })
    );

    expect(document.activeElement).toBe(cancel);
  });

  it('shows server-confirmed success revision/time and retains context on failure with retry', () => {
    store.publish.mockReturnValue(
      throwError(() => new Error('Release service unavailable'))
    );
    (
      fixture.nativeElement.querySelector(
        'button[data-action="publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'button[data-action="confirm-publish"]'
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Release service unavailable'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Revision'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('7');
    expect(
      fixture.nativeElement.querySelector('button[data-action="retry-publish"]')
    ).not.toBeNull();
  });
});
