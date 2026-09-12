import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, provideZoneChangeDetection, signal } from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  provideRouter,
  RouterOutlet,
  Router,
} from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import {
  AppConfigStore,
  WorkspaceDiscoveryStore,
} from '@optimistic-tanuki/app-config-data-access';
import { OwnerWorkspaceConfigEditorComponent } from './owner-workspace-config-editor.component';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';
import { ownerWorkspaceConfigEditorDeactivateGuard } from '../guards/owner-workspace-config-editor-deactivate.guard';

@Component({ standalone: true, template: '<p>Owner desk</p>' })
class OwnerDeskRouteComponent {}

@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
})
class NavigationTestShellComponent {}

const config: AppConfiguration = {
  id: 'config-1',
  appScope: 'configurable-client',
  name: 'North Star Client',
  description: 'A private client doorway',
  domain: 'north-star.local',
  revision: 13,
  active: true,
  landingPage: {
    layout: 'single-column',
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        order: 0,
        visible: true,
        title: 'Original title',
        subtitle: 'Original subtitle',
        ctaText: 'Get started',
        ctaLink: '/start',
      },
    ],
  },
  routes: [
    {
      id: 'home',
      path: '/',
      name: 'Home',
      componentType: 'landing',
      order: 0,
      showInNav: true,
    },
  ],
  features: {
    social: { enabled: false, showComments: false },
    tasks: { enabled: false },
    blogging: { enabled: false },
    projectPlanning: { enabled: false },
  },
  theme: {
    mode: 'light',
    personalityId: 'foundation',
    primaryColor: '#3457d5',
  },
};

const workspace = {
  workspaceId: 'workspace-1',
  appInstanceId: 'app-1',
  configurationId: 'config-1',
  kind: 'business-site' as const,
  slug: 'north-star',
  displayName: 'North Star',
  appScope: 'configurable-client',
  status: 'active' as const,
  membershipRole: 'owner' as const,
  membershipStatus: 'active' as const,
};

describe('OwnerWorkspaceConfigEditorComponent navigation', () => {
  let selected: ReturnType<typeof signal<AppConfiguration | null>>;
  let workspaces: ReturnType<typeof signal<(typeof workspace)[]>>;
  let appStore: Record<string, unknown>;
  let discoveryStore: Record<string, unknown>;

  const editorUrl = '/owner/workspace/north-star/config/config-1';
  const deskUrl = '/owner/workspace/north-star';

  beforeEach(() => {
    selected = signal<AppConfiguration | null>(config);
    workspaces = signal([workspace]);
    appStore = {
      selected,
      draft: signal<unknown>(null),
      latest: signal<AppConfiguration | null>(null),
      latestLoading: signal(false),
      latestError: signal<string | null>(null),
      loadError: signal<string | null>(null),
      saveError: signal<string | null>(null),
      saveConflict: signal(false),
      saving: signal(false),
      load: jest.fn(),
      setDraft: jest.fn(),
      save: jest.fn(),
      cancelPendingSave: jest.fn(),
      refreshLatest: jest.fn(),
      acceptLatest: jest.fn(),
      clearDraft: jest.fn(),
      clearSaveRecovery: jest.fn(),
    };
    discoveryStore = {
      workspaces,
      loading: signal(false),
      error: signal<string | null>(null),
      load: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [OwnerDeskRouteComponent],
      providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        ...provideLocationMocks(),
        provideRouter([
          {
            path: '',
            component: NavigationTestShellComponent,
            children: [
              {
                path: 'owner/workspace/:workspaceSlug',
                component: OwnerDeskRouteComponent,
              },
              {
                path: 'owner/workspace/:workspaceSlug/config/:configId',
                component: OwnerWorkspaceConfigEditorComponent,
                canDeactivate: [ownerWorkspaceConfigEditorDeactivateGuard],
              },
            ],
          },
        ]),
        { provide: AppConfigStore, useValue: appStore },
        { provide: WorkspaceDiscoveryStore, useValue: discoveryStore },
        NavigationConfirmationService,
      ],
    });
  });

  function editTitle(harness: RouterTestingHarness): HTMLInputElement {
    const editorElement = harness.fixture.debugElement.query(
      By.directive(OwnerWorkspaceConfigEditorComponent)
    ).nativeElement as HTMLElement;
    (
      editorElement.querySelector('.canvas-block-card') as HTMLButtonElement
    )?.click();
    harness.fixture.detectChanges();
    const titleInput = editorElement.querySelector(
      '#field-title input'
    ) as HTMLInputElement | null;
    if (!titleInput)
      throw new Error('The real editor title input was not rendered.');
    titleInput.value = 'Keep this unsaved title';
    titleInput.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText' })
    );
    harness.fixture.detectChanges();
    return titleInput;
  }

  function waitForNavigation(
    router: Router
  ): Promise<NavigationEnd | NavigationCancel> {
    return new Promise((resolve) => {
      const subscription = router.events.subscribe((event) => {
        if (
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel
        ) {
          subscription.unsubscribe();
          resolve(event);
        }
      });
    });
  }

  it('renders the editor-owned shared modal before starting dirty back-link navigation', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    editTitle(harness);
    const router = TestBed.inject(Router);
    (
      harness.fixture.debugElement
        .query(By.directive(OwnerWorkspaceConfigEditorComponent))
        .nativeElement.querySelector('a.back-link') as HTMLAnchorElement
    ).click();
    harness.fixture.detectChanges();

    expect(
      harness.fixture.nativeElement.querySelector('otui-modal')
    ).not.toBeNull();
    expect(
      harness.fixture.nativeElement.querySelector('.modal-dialog')
    ).not.toBeNull();
    expect(router.url).toBe(editorUrl);

    (
      harness.fixture.nativeElement.querySelector(
        '[data-action="stay-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();
    expect(router.url).toBe(editorUrl);
  });

  it('navigates a clean back-link directly to the owner desk', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);

    (
      harness.fixture.debugElement
        .query(By.directive(OwnerWorkspaceConfigEditorComponent))
        .nativeElement.querySelector('a.back-link') as HTMLAnchorElement
    ).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(deskUrl);
  });

  it('guards a real owner-desk link after a real edit and retains the edit on decline', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    const editor = harness.fixture.debugElement.query(
      By.directive(OwnerWorkspaceConfigEditorComponent)
    ).componentInstance as OwnerWorkspaceConfigEditorComponent;
    const titleInput = editTitle(harness);
    expect(editor.isDirty).toBe(true);
    const confirmSpy = jest.spyOn(window, 'confirm');
    const router = TestBed.inject(Router);
    (
      harness.fixture.debugElement
        .query(By.directive(OwnerWorkspaceConfigEditorComponent))
        .nativeElement.querySelector('a.back-link') as HTMLAnchorElement
    ).click();
    harness.fixture.detectChanges();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe(editorUrl);
    const dialog = harness.fixture.nativeElement.querySelector(
      '.modal-dialog'
    ) as HTMLElement;
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(
      dialog?.querySelector('#navigation-confirmation-title')?.textContent
    ).toContain('Leave this configuration?');
    expect(dialog?.textContent).toContain('You have unsaved changes.');
    expect(
      dialog?.querySelector('[data-action="stay-unsaved-navigation"]')
    ).not.toBeNull();
    expect(
      dialog?.querySelector('[data-action="leave-unsaved-navigation"]')
    ).not.toBeNull();
    (
      harness.fixture.nativeElement.querySelector(
        '[data-action="stay-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(editorUrl);
    expect(editor.isDirty).toBe(true);
    expect(editor.currentConfig?.landingPage.sections[0].title).toBe(
      'Keep this unsaved title'
    );
    expect(titleInput.value).toBe('Keep this unsaved title');
    confirmSpy.mockRestore();
  });

  it('allows the owner-desk link to navigate after the user accepts discard', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    editTitle(harness);
    const confirmSpy = jest.spyOn(window, 'confirm');
    const router = TestBed.inject(Router);
    const navigateByUrl = jest.spyOn(router, 'navigateByUrl');
    (
      harness.fixture.debugElement
        .query(By.directive(OwnerWorkspaceConfigEditorComponent))
        .nativeElement.querySelector('a.back-link') as HTMLAnchorElement
    ).click();
    navigateByUrl.mockClear();
    harness.fixture.detectChanges();
    expect(confirmSpy).not.toHaveBeenCalled();
    (
      harness.fixture.nativeElement.querySelector(
        '[data-action="leave-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(deskUrl);
    expect(navigateByUrl).toHaveBeenCalledTimes(1);
    expect(navigateByUrl).toHaveBeenCalledWith(deskUrl);
    confirmSpy.mockRestore();
  });

  it('guards a real browser popstate after a real edit and keeps the editor value until accepted', async () => {
    const harness = await RouterTestingHarness.create();
    const router = TestBed.inject(Router);
    const location = TestBed.inject(Location);
    const browserLocation = location as Location & {
      simulateUrlPop(path: string): void;
    };
    router.initialNavigation();
    await harness.navigateByUrl(deskUrl, NavigationTestShellComponent);
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    const editor = harness.fixture.debugElement.query(
      By.directive(OwnerWorkspaceConfigEditorComponent)
    ).componentInstance as OwnerWorkspaceConfigEditorComponent;
    const titleInput = editTitle(harness);
    const confirmSpy = jest.spyOn(window, 'confirm');
    expect(location.path()).toBe(editorUrl);

    const declinedNavigation = waitForNavigation(router);
    browserLocation.simulateUrlPop(deskUrl);
    expect(await declinedNavigation).toBeInstanceOf(NavigationCancel);
    harness.fixture.detectChanges();
    expect(confirmSpy).not.toHaveBeenCalled();
    (
      harness.fixture.nativeElement.querySelector(
        '[data-action="stay-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    await harness.fixture.whenStable();

    expect(router.url).toBe(editorUrl);
    expect(editor.currentConfig?.landingPage.sections[0].title).toBe(
      'Keep this unsaved title'
    );
    expect(titleInput.value).toBe('Keep this unsaved title');
    expect(confirmSpy).not.toHaveBeenCalled();

    const acceptedNavigation = waitForNavigation(router);
    browserLocation.simulateUrlPop(deskUrl);
    expect(await acceptedNavigation).toBeInstanceOf(NavigationCancel);
    harness.fixture.detectChanges();
    const retriedNavigation = waitForNavigation(router);
    (
      harness.fixture.nativeElement.querySelector(
        '[data-action="leave-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    expect(await retriedNavigation).toBeInstanceOf(NavigationEnd);
    await harness.fixture.whenStable();

    expect(router.url).toBe(deskUrl);
    confirmSpy.mockRestore();
  });

  it('treats Escape on the shared modal as Stay without losing the edit', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    const titleInput = editTitle(harness);
    const router = TestBed.inject(Router);
    (
      harness.fixture.nativeElement.querySelector(
        'a.back-link'
      ) as HTMLAnchorElement
    ).click();
    harness.fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    harness.fixture.detectChanges();

    expect(router.url).toBe(editorUrl);
    expect(titleInput.value).toBe('Keep this unsaved title');
    expect(TestBed.inject(NavigationConfirmationService).isPending()).toBe(
      false
    );
  });

  it('treats a backdrop click on the shared modal as Stay without losing the edit', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(editorUrl, NavigationTestShellComponent);
    const titleInput = editTitle(harness);
    const router = TestBed.inject(Router);
    (
      harness.fixture.nativeElement.querySelector(
        'a.back-link'
      ) as HTMLAnchorElement
    ).click();
    harness.fixture.detectChanges();

    (
      harness.fixture.nativeElement.querySelector(
        '.modal-overlay'
      ) as HTMLElement
    ).click();
    harness.fixture.detectChanges();

    expect(router.url).toBe(editorUrl);
    expect(titleInput.value).toBe('Keep this unsaved title');
    expect(TestBed.inject(NavigationConfirmationService).isPending()).toBe(
      false
    );
  });
});
