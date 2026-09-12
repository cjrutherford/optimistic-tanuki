import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import type { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS } from '@optimistic-tanuki/app-config-models';
import { Subject } from 'rxjs';
import {
  AppConfigStore,
  WorkspaceDiscoveryStore,
} from '@optimistic-tanuki/app-config-data-access';
import { AppConfigApiService } from '@optimistic-tanuki/app-config-data-access';
import { of } from 'rxjs';
import { OwnerWorkspaceConfigEditorComponent } from './owner-workspace-config-editor.component';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';

const config: AppConfiguration = {
  id: 'config-1',
  appScope: 'configurable-client',
  name: 'North Star Client',
  description: 'A private client doorway',
  domain: 'north-star.local',
  revision: 4,
  active: true,
  landingPage: {
    layout: 'wide',
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        order: 0,
        visible: true,
        title: 'A clear beginning',
        subtitle: 'A useful promise',
        ctaText: 'Get started',
        ctaLink: '/start',
      },
      {
        id: 'content-1',
        type: 'content',
        order: 1,
        visible: true,
        title: 'Our approach',
        content: 'A considered explanation.',
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
    blogging: { enabled: true, allowComments: false, moderateComments: true },
    social: { enabled: false, showComments: false },
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

describe('OwnerWorkspaceConfigEditorComponent', () => {
  let fixture: ComponentFixture<OwnerWorkspaceConfigEditorComponent>;
  let component: OwnerWorkspaceConfigEditorComponent;
  let appStore: {
    selected: () => AppConfiguration | null;
    draft: () => unknown;
    latest: () => AppConfiguration | null;
    latestLoading: () => boolean;
    latestError: () => string | null;
    loadError: () => string | null;
    saveError: () => string | null;
    saveConflict: () => boolean;
    saving: () => boolean;
    load: jest.Mock;
    setDraft: jest.Mock;
    save: jest.Mock;
    cancelPendingSave: jest.Mock;
    refreshLatest: jest.Mock;
    acceptLatest: jest.Mock;
    clearDraft: jest.Mock;
    clearSaveRecovery: jest.Mock;
  };
  let discoveryStore: {
    workspaces: () => (typeof workspace)[];
    loading: () => boolean;
    error: () => string | null;
    load: jest.Mock;
  };
  let routeParams: Subject<ParamMap>;
  let selectedConfig: ReturnType<typeof signal<AppConfiguration | null>>;
  let discoveredWorkspaces: ReturnType<typeof signal<(typeof workspace)[]>>;
  let discoveryLoading: ReturnType<typeof signal<boolean>>;
  let discoveryError: ReturnType<typeof signal<string | null>>;
  let appLoadError: ReturnType<typeof signal<string | null>>;
  let draft: ReturnType<typeof signal<unknown>>;
  let saveError: ReturnType<typeof signal<string | null>>;
  let saveConflict: ReturnType<typeof signal<boolean>>;
  let saving: ReturnType<typeof signal<boolean>>;
  let latest: ReturnType<typeof signal<AppConfiguration | null>>;
  let latestLoading: ReturnType<typeof signal<boolean>>;
  let latestError: ReturnType<typeof signal<string | null>>;
  let navigationConfirmation: NavigationConfirmationService;
  let router: {
    url: string;
    navigateByUrl: jest.Mock;
    createUrlTree: jest.Mock;
    serializeUrl: jest.Mock;
    events: ReturnType<typeof of>;
  };

  beforeEach(async () => {
    routeParams = new Subject<ParamMap>();
    selectedConfig = signal<AppConfiguration | null>(config);
    discoveredWorkspaces = signal<(typeof workspace)[]>([workspace]);
    discoveryLoading = signal(false);
    discoveryError = signal<string | null>(null);
    appLoadError = signal<string | null>(null);
    draft = signal<unknown>(null);
    saveError = signal<string | null>(null);
    saveConflict = signal(false);
    saving = signal(false);
    latest = signal<AppConfiguration | null>(null);
    latestLoading = signal(false);
    latestError = signal<string | null>(null);
    router = {
      url: '/owner/workspace/north-star/config/config-1',
      navigateByUrl: jest.fn(),
      createUrlTree: jest.fn((commands: unknown[]) => commands.join('/')),
      serializeUrl: jest.fn((urlTree: unknown) => String(urlTree)),
      events: of(),
    };
    appStore = {
      selected: selectedConfig,
      draft,
      latest,
      latestLoading,
      latestError,
      loadError: appLoadError,
      saveError,
      saveConflict,
      saving,
      load: jest.fn(),
      setDraft: jest.fn((patch: unknown) => draft.set(patch)),
      save: jest.fn(),
      cancelPendingSave: jest.fn(),
      refreshLatest: jest.fn(),
      acceptLatest: jest.fn(),
      clearDraft: jest.fn(() => draft.set(null)),
      clearSaveRecovery: jest.fn(),
    };
    discoveryStore = {
      workspaces: discoveredWorkspaces,
      loading: discoveryLoading,
      error: discoveryError,
      load: jest.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [OwnerWorkspaceConfigEditorComponent],
      providers: [
        { provide: AppConfigStore, useValue: appStore },
        { provide: WorkspaceDiscoveryStore, useValue: discoveryStore },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
            snapshot: {
              paramMap: new Map([
                ['workspaceSlug', 'north-star'],
                ['configId', 'config-1'],
              ]),
              queryParamMap: new Map(),
            },
          },
        },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerWorkspaceConfigEditorComponent);
    component = fixture.componentInstance;
    navigationConfirmation = TestBed.inject(NavigationConfirmationService);
    fixture.detectChanges();
  });

  it('renders the selected configuration when the signal-backed route workspace and config scope match', () => {
    expect(appStore.load).toHaveBeenCalledWith('config-1', 'north-star');
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('North Star');
    expect(host.textContent).toContain('North Star Client');
    expect(host.textContent).toContain('Landing page');
    expect(host.textContent).toContain('A clear beginning');
    expect(host.textContent).toContain('Theme & personality');
    expect(host.textContent).toContain('Enabled features');
    expect(host.textContent).toContain('Blogging');
    expect(host.textContent).toContain('Navigation');
    expect(host.textContent).toContain('Home');
  });

  it('prevents full-page unload only while dirty', () => {
    const cleanEvent = new Event('beforeunload', { cancelable: true });
    component.onBeforeUnload(cleanEvent as BeforeUnloadEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Local draft' });
    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    component.onBeforeUnload(dirtyEvent as BeforeUnloadEvent);

    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it('keeps the current editor and restores the previous URL when a dirty scope change is declined', async () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Keep this draft' });

    routeParams.next(
      new Map([
        ['workspaceSlug', 'south-star'],
        ['configId', 'config-2'],
      ]) as unknown as ParamMap
    );
    fixture.detectChanges();

    navigationConfirmation.resolve(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.workspaceSlug).toBe('north-star');
    expect(component.configId).toBe('config-1');
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Keep this draft'
    );
    expect(appStore.load).toHaveBeenCalledTimes(1);
    expect(router.navigateByUrl).toHaveBeenCalledWith(
      '/owner/workspace/north-star/config/config-1',
      { replaceUrl: true }
    );
    expect(component.isDirty).toBe(true);
  });

  it('clears local recovery before loading an accepted same-component scope change', async () => {
    const secondWorkspace = {
      ...workspace,
      workspaceId: 'workspace-2',
      appInstanceId: 'app-2',
      configurationId: 'config-2',
      slug: 'south-star',
      displayName: 'South Star',
    };
    const secondConfig = {
      ...config,
      id: 'config-2',
      name: 'South Star Client',
    };
    discoveredWorkspaces.set([workspace, secondWorkspace]);
    selectedConfig.set(secondConfig);
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Discard this draft' });

    routeParams.next(
      new Map([
        ['workspaceSlug', 'south-star'],
        ['configId', 'config-2'],
      ]) as unknown as ParamMap
    );
    fixture.detectChanges();

    navigationConfirmation.resolve(true);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.workspaceSlug).toBe('south-star');
    expect(component.configId).toBe('config-2');
    expect(component.isDirty).toBe(false);
    expect(appStore.clearDraft).toHaveBeenCalledTimes(1);
    expect(appStore.clearSaveRecovery).toHaveBeenCalledTimes(1);
    expect(appStore.load).toHaveBeenLastCalledWith('config-2', 'south-star');
    expect(appStore.clearSaveRecovery.mock.invocationCallOrder[0]).toBeLessThan(
      appStore.load.mock.invocationCallOrder[
        appStore.load.mock.invocationCallOrder.length - 1
      ] as number
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Keep this draft'
    );
  });

  it('represents a foreign or unavailable workspace without rendering configuration data', () => {
    discoveredWorkspaces.set([]);
    routeParams.next(
      new Map([
        ['workspaceSlug', 'foreign-space'],
        ['configId', 'secret-config'],
      ]) as unknown as ParamMap
    );
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Configuration unavailable');
    expect(host.textContent).not.toContain('North Star Client');
    expect(appStore.load).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a different workspace', 'south-star', 'config-1'],
    ['a different configuration', 'north-star', 'secret-config'],
  ])(
    'renders unavailable without disclosing selected data for %s',
    (_label, workspaceSlug, configId) => {
      discoveredWorkspaces.set([workspace]);
      routeParams.next(
        new Map([
          ['workspaceSlug', workspaceSlug],
          ['configId', configId],
        ]) as unknown as ParamMap
      );
      fixture.detectChanges();

      const host = fixture.nativeElement as HTMLElement;
      expect(host.textContent).toContain('Configuration unavailable');
      expect(host.textContent).not.toContain('North Star Client');
    }
  );

  it('rejects invalid section input with an actionable field error without staging or saving', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: '' });
    component.save();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Hero title is required'
    );
    expect(appStore.setDraft).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
  });

  it('rejects an unsupported personality before staging or saving', () => {
    component.onThemeChanged({
      key: 'personalityId',
      value: 'not-a-real-personality',
    });
    component.save();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Choose a supported personality'
    );
    expect(appStore.setDraft).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
  });

  it('rejects an invalid theme color before staging or saving with its expected format', () => {
    component.onThemeChanged({ key: 'primaryColor', value: '#12ab' });
    component.save();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Primary color must be a valid 6-digit hex color'
    );
    expect(appStore.setDraft).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
  });

  it('wires shared workspace mutations into valid landing sections while preserving stable IDs', () => {
    const workspaceComponent = fixture.debugElement.query(
      By.css('app-configurator-editor-workspace')
    ).componentInstance as {
      blockSelected: { emit: (blockId: string) => void };
      insertRequested: { emit: () => void };
      moveFirstRequested: { emit: () => void };
      removeRequested: { emit: () => void };
    };

    workspaceComponent.blockSelected.emit('content-1');
    fixture.detectChanges();
    expect(component.selectedBlockId).toBe('content-1');
    expect(component.blocks.map((block) => block.id)).toEqual([
      'hero-1',
      'content-1',
    ]);
    const move = jest.spyOn(component, 'onMoveFirstRequested');
    workspaceComponent.moveFirstRequested.emit();
    expect(move).toHaveBeenCalled();
    expect(component.blocks.map((block) => block.id)).toEqual([
      'content-1',
      'hero-1',
    ]);

    workspaceComponent.removeRequested.emit();
    expect(component.blocks.map((block) => block.id)).toEqual(['hero-1']);

    workspaceComponent.insertRequested.emit();
    expect(component.blocks).toHaveLength(2);
    expect(new Set(component.blocks.map((block) => block.id)).size).toBe(2);
    expect(component.blocks[1]).toEqual(
      expect.objectContaining({
        type: 'hero',
        renderContext: 'landing-page',
      })
    );
  });

  it('stages a valid typed configuration through the store and starts the revision-aware save path', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'A better beginning' });
    component.save();

    expect(appStore.setDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        landingPage: expect.objectContaining({
          layout: 'wide',
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'hero-1',
              title: 'A better beginning',
            }),
          ]),
        }),
        theme: expect.objectContaining({ personalityId: 'foundation' }),
        features: expect.objectContaining({
          blogging: expect.objectContaining({ enabled: true }),
        }),
        routes: expect.arrayContaining([
          expect.objectContaining({ path: '/', showInNav: true }),
        ]),
      })
    );
    expect(appStore.setDraft.mock.calls[0][0]).not.toHaveProperty(
      'expectedRevision'
    );
    expect(appStore.save).toHaveBeenCalledTimes(1);
  });

  it('renders loading, unavailable, and scoped load-error states', () => {
    discoveryLoading.set(true);
    selectedConfig.set(null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Verifying workspace access'
    );

    discoveryLoading.set(false);
    discoveryError.set('Workspace service unavailable');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Configuration unavailable'
    );

    discoveryError.set(null);
    discoveredWorkspaces.set([workspace]);
    appLoadError.set('Configuration could not be loaded.');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Configuration could not be loaded.'
    );
  });

  it('retries the authoritative owner scope in place and renders the recovered configuration', () => {
    selectedConfig.set(null);
    appLoadError.set('Temporary configuration outage.');
    fixture.detectChanges();

    const retry = fixture.nativeElement.querySelector(
      'button[type="button"]'
    ) as HTMLButtonElement;
    expect(retry).not.toBeNull();
    expect(retry.textContent).toContain('Retry');

    appStore.load.mockImplementationOnce(() => {
      appLoadError.set(null);
      selectedConfig.set(config);
    });
    retry.click();
    fixture.detectChanges();

    expect(appStore.load).toHaveBeenLastCalledWith('config-1', 'north-star');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'North Star Client'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'A clear beginning'
    );
  });

  it('rejects a selected configuration from a different application scope', () => {
    selectedConfig.set({ ...config, appScope: 'business-site' });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Configuration unavailable');
    expect(host.textContent).not.toContain('North Star Client');
  });

  it('rejects protocol-relative navigation paths', () => {
    component.onRouteChanged(0, 'path', '//attacker.example/redirect');
    component.save();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Use a supported local path or absolute URL.'
    );
    expect(appStore.setDraft).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
  });

  it.each([
    '/about',
    'http://example.com/about',
    'https://example.com/about',
    'mailto:owner@example.com',
    'tel:+15551234567',
  ])('accepts supported navigation path %s', (path) => {
    component.onRouteChanged(0, 'path', path);
    component.save();

    expect(appStore.setDraft).toHaveBeenCalled();
    expect(appStore.save).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Hero CTA link', 'hero-1', 'ctaLink'],
    ['Hero background image', 'hero-1', 'backgroundImage'],
    ['Hero background source', 'hero-1', 'background.src'],
    ['Content image URL', 'content-1', 'imageUrl'],
    ['Content image source', 'content-1', 'image.src'],
  ] as const)(
    'rejects protocol-relative URLs in the %s block field',
    (_label, blockId, key) => {
      component.onBlockSelected(blockId);
      component.onFieldChanged({ key, value: '//attacker.example/resource' });
      component.save();
      fixture.detectChanges();

      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'must be a valid URL or local path'
      );
      expect(appStore.setDraft).not.toHaveBeenCalled();
      expect(appStore.save).not.toHaveBeenCalled();
    }
  );

  it.each(['/images/hero.png', 'https://cdn.example.com/hero.png'])(
    'preserves supported URL-field values %s',
    (value) => {
      component.onBlockSelected('hero-1');
      component.onFieldChanged({ key: 'backgroundImage', value });
      component.save();

      expect(appStore.setDraft).toHaveBeenCalled();
      expect(appStore.save).toHaveBeenCalledTimes(1);
    }
  );

  it('uses the owner dashboard return path as a visible escape hatch', () => {
    expect(
      fixture.nativeElement.querySelector(
        'a[href="/owner/workspace/north-star"]'
      )
    ).not.toBeNull();
  });

  it('keeps the shared block registry as the source of landing field definitions', () => {
    expect(component.blockDefinitions).toBe(
      APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS
    );
    expect(
      component.blockDefinitions.hero.fields?.some(
        (field) => field.key === 'title'
      )
    ).toBe(true);
  });

  it('keeps the staged draft and exposes an accessible Retry save action after an ordinary save failure', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Local draft title' });
    component.save();
    saveError.set('network offline');
    fixture.detectChanges();

    const retry = fixture.nativeElement.querySelector(
      '[data-action="retry-save"]'
    ) as HTMLButtonElement;
    expect(retry).not.toBeNull();
    expect(retry.getAttribute('aria-label')).toBe('Retry save');
    expect(draft()).toEqual(
      expect.objectContaining({
        landingPage: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ title: 'Local draft title' }),
          ]),
        }),
      })
    );

    retry.click();

    expect(appStore.save).toHaveBeenCalledTimes(2);
    expect(draft()).not.toBeNull();
  });

  it('validates and stages the current editor draft before retrying a failed save', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'First local title' });
    component.save();
    component.onFieldChanged({ key: 'title', value: 'Newer local title' });

    component.retrySave();

    expect(appStore.setDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        landingPage: expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ title: 'Newer local title' }),
          ]),
        }),
      })
    );
    expect(appStore.save).toHaveBeenCalledTimes(2);
  });

  it('does not stage or retry an invalid current editor draft', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: '' });

    component.retrySave();

    expect(appStore.setDraft).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
    expect(component.validationErrorEntries).toEqual([
      ['Landing page / Hero / Title', 'Hero title is required.'],
    ]);
  });

  it('opens a shared conflict modal without choosing a recovery action when dismissed', () => {
    saveError.set(
      'Configuration changed elsewhere. Reload the latest revision before retrying.'
    );
    saveConflict.set(true);
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector(
      'otui-modal'
    ) as HTMLElement;
    expect(modal).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Reload latest'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Compare'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Keep local'
    );
    expect(appStore.refreshLatest).toHaveBeenCalledTimes(1);

    const modalComponent = fixture.debugElement.query(
      By.directive(ModalComponent)
    ).componentInstance as ModalComponent;
    modalComponent.onEscape(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(appStore.acceptLatest).not.toHaveBeenCalled();
    expect(component.conflictModalOpen).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-action="reopen-conflict"]')
    ).not.toBeNull();
  });

  it('keeps conflict recovery available after Cancel and reopens without resubmitting', () => {
    saveConflict.set(true);
    latestLoading.set(false);
    latest.set({ ...config, revision: 5 });
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('[data-action="cancel-conflict"]')
      .click();
    fixture.detectChanges();

    expect(component.conflictModalOpen).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-action="reopen-conflict"]')
    ).not.toBeNull();
    expect(appStore.acceptLatest).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();

    fixture.nativeElement
      .querySelector('[data-action="reopen-conflict"]')
      .click();
    fixture.detectChanges();

    expect(component.conflictModalOpen).toBe(true);
    expect(appStore.acceptLatest).not.toHaveBeenCalled();
    expect(appStore.save).not.toHaveBeenCalled();
  });

  it('compares changed supported fields and applies latest only after an explicit Reload latest choice', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Local title' });
    const latestConfig = {
      ...config,
      revision: 5,
      landingPage: {
        ...config.landingPage,
        sections: config.landingPage.sections.map((section) =>
          section.id === 'hero-1'
            ? { ...section, title: 'Latest title' }
            : section
        ),
      },
    };
    saveConflict.set(true);
    latestLoading.set(false);
    latest.set(latestConfig);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('[data-action="compare-conflict"]')
      .click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Landing page / Hero / Title'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Local title'
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Latest title'
    );
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Local title'
    );

    fixture.nativeElement
      .querySelector('[data-action="reload-latest"]')
      .click();

    expect(appStore.acceptLatest).toHaveBeenCalledWith({
      preserveDraft: false,
    });
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Latest title'
    );
    expect(component.isDirty).toBe(false);
  });

  it('reports block metadata, arbitrary data, manifest, and active changes in conflict comparison', () => {
    const latestConfig = {
      ...config,
      active: false,
      manifest: {
        schemaVersion: 1,
        surfaceType: 'business-site' as const,
        capabilities: {
          'blogging.posts': { enabled: true, settings: { mode: 'latest' } },
        },
      },
      landingPage: {
        ...config.landingPage,
        sections: [
          {
            ...config.landingPage.sections[1],
            order: 0,
          },
          {
            ...config.landingPage.sections[0],
            type: 'cta' as const,
            order: 1,
            visible: false,
            renderContext: 'rich-text',
            customRenderingData: { accent: 'violet', priority: 2 },
          },
        ],
      },
    } as unknown as AppConfiguration;
    saveConflict.set(true);
    latestLoading.set(false);
    latest.set(latestConfig);
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector('[data-action="compare-conflict"]')
      .click();
    fixture.detectChanges();

    const fields = component.conflictDifferences.map(
      (difference) => difference.field
    );
    expect(fields).toEqual(
      expect.arrayContaining([
        'Application / Active',
        'Manifest / Capabilities / blogging.posts / Settings / Mode',
        'Landing page / Blocks / hero-1 / Type',
        'Landing page / Blocks / hero-1 / Order',
        'Landing page / Blocks / hero-1 / Enabled',
        'Landing page / Blocks / hero-1 / Render context',
        'Landing page / Blocks / hero-1 / Data / Custom rendering data / Accent',
      ])
    );
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'violet'
    );
  });

  it.each(['keep-local', 'reload-latest'])(
    'restores focus to the save action after %s removes the recovery modal',
    fakeAsync((action: string) => {
      const opener = fixture.nativeElement.querySelector(
        '.save-button'
      ) as HTMLButtonElement;
      opener.focus();

      saveConflict.set(true);
      latestLoading.set(false);
      latest.set({ ...config, revision: 5 });
      fixture.detectChanges();
      tick(100);

      (
        fixture.nativeElement.querySelector(
          `[data-action="${action}"]`
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();
      tick();

      expect(document.activeElement).toBe(opener);
    })
  );

  it('uses one described-by element for the conflict modal while retaining its aria reference', () => {
    saveConflict.set(true);
    latestLoading.set(false);
    latest.set({ ...config, revision: 5 });
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('#conflict-modal-description')).toHaveLength(
      1
    );
    expect(
      host.querySelector('.modal-dialog')?.getAttribute('aria-describedby')
    ).toBe('conflict-modal-description');
  });

  it('keeps the local editor and draft when Keep local is chosen without auto-submitting', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Keep my local title' });
    component.save();
    const localConfig = component.currentConfig;
    const latestConfig = { ...config, revision: 5 };
    saveConflict.set(true);
    latest.set(latestConfig);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('[data-action="keep-local"]').click();

    expect(appStore.acceptLatest).toHaveBeenCalledWith({ preserveDraft: true });
    expect(component.currentConfig).toBe(localConfig);
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Keep my local title'
    );
    expect(draft()).not.toBeNull();
    expect(component.isDirty).toBe(true);
    expect(appStore.save).toHaveBeenCalledTimes(1);
  });

  it('leaves the local editor intact and retries the latest fetch after a latest-fetch failure', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({
      key: 'title',
      value: 'Unsaved while latest is unavailable',
    });
    saveConflict.set(true);
    latestError.set('network offline');
    latestLoading.set(false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'network offline'
    );
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Unsaved while latest is unavailable'
    );
    expect(component.isDirty).toBe(true);

    fixture.nativeElement.querySelector('[data-action="retry-latest"]').click();

    expect(appStore.refreshLatest).toHaveBeenCalledTimes(2);
    expect(component.currentConfig?.landingPage.sections[0].title).toBe(
      'Unsaved while latest is unavailable'
    );
  });
});

describe('OwnerWorkspaceConfigEditorComponent deferred store save recovery', () => {
  let fixture: ComponentFixture<OwnerWorkspaceConfigEditorComponent>;
  let component: OwnerWorkspaceConfigEditorComponent;
  let api: { get: jest.Mock; update: jest.Mock };
  let firstSaveResponse: Subject<AppConfiguration>;
  let retrySaveResponse: Subject<AppConfiguration>;
  let routeParams: Subject<ParamMap>;
  let discoveredWorkspaces: ReturnType<typeof signal<(typeof workspace)[]>>;
  let navigationConfirmation: NavigationConfirmationService;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    firstSaveResponse = new Subject<AppConfiguration>();
    retrySaveResponse = new Subject<AppConfiguration>();
    routeParams = new Subject<ParamMap>();
    discoveredWorkspaces = signal<(typeof workspace)[]>([workspace]);
    const scopedConfig = {
      ...config,
      workspaceId: workspace.workspaceId,
      appInstanceId: workspace.appInstanceId,
    };
    api = {
      get: jest.fn().mockReturnValue(of(scopedConfig)),
      update: jest
        .fn()
        .mockReturnValueOnce(firstSaveResponse)
        .mockReturnValueOnce(retrySaveResponse),
    };

    await TestBed.configureTestingModule({
      imports: [OwnerWorkspaceConfigEditorComponent],
      providers: [
        AppConfigStore,
        { provide: AppConfigApiService, useValue: api },
        {
          provide: WorkspaceDiscoveryStore,
          useValue: {
            workspaces: discoveredWorkspaces,
            loading: () => false,
            error: () => null,
            load: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable(),
            snapshot: {
              paramMap: new Map([
                ['workspaceSlug', 'north-star'],
                ['configId', 'config-1'],
              ]),
              queryParamMap: new Map(),
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigateByUrl: jest.fn(),
            createUrlTree: jest.fn((commands: unknown[]) => commands.join('/')),
            serializeUrl: jest.fn((urlTree: unknown) => String(urlTree)),
            events: of(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OwnerWorkspaceConfigEditorComponent);
    component = fixture.componentInstance;
    navigationConfirmation = TestBed.inject(NavigationConfirmationService);
    fixture.detectChanges();
  });

  it('omits a null manifest while preserving the loaded baseline and revision precondition', () => {
    const scopedConfig = {
      ...config,
      revision: 15,
      manifest: null as unknown as AppConfiguration['manifest'],
      workspaceId: workspace.workspaceId,
      appInstanceId: workspace.appInstanceId,
    };
    api.get.mockReturnValue(of(scopedConfig));
    api.update
      .mockReset()
      .mockReturnValue(
        of({ ...scopedConfig, manifest: undefined, revision: 16 })
      );
    component.store.load('config-1', 'north-star');
    fixture.detectChanges();

    component.onBlockSelected('hero-1');
    component.onFieldChanged({
      key: 'title',
      value: 'Saved without a manifest',
    });
    component.save();

    expect(api.update).toHaveBeenCalledTimes(1);
    const update = api.update.mock.calls[0][1] as Record<string, unknown>;
    expect(update).toEqual({
      expectedRevision: 15,
      name: scopedConfig.name,
      description: scopedConfig.description,
      domain: scopedConfig.domain,
      landingPage: expect.objectContaining({
        ...scopedConfig.landingPage,
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'hero-1',
            title: 'Saved without a manifest',
          }),
        ]),
      }),
      routes: scopedConfig.routes,
      features: scopedConfig.features,
      theme: scopedConfig.theme,
      active: scopedConfig.active,
    });
    expect(update).not.toHaveProperty('manifest');
  });

  it('preserves a valid loaded manifest in the revision-aware update', () => {
    const manifest = {
      schemaVersion: 1 as const,
      surfaceType: 'generic' as const,
      capabilities: {
        blogging: { enabled: true, placement: 'primary-nav' },
      },
    };
    const scopedConfig = {
      ...config,
      revision: 15,
      manifest,
      workspaceId: workspace.workspaceId,
      appInstanceId: workspace.appInstanceId,
    };
    api.get.mockReturnValue(of(scopedConfig));
    api.update
      .mockReset()
      .mockReturnValue(of({ ...scopedConfig, revision: 16 }));
    component.store.load('config-1', 'north-star');
    fixture.detectChanges();

    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Saved with a manifest' });
    component.save();

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.update.mock.calls[0][1]).toEqual(
      expect.objectContaining({ expectedRevision: 15, manifest })
    );
  });

  it('clears the editor dirty state after a successful save without a newer edit', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Saved title' });
    component.save();

    expect(component.isDirty).toBe(true);
    firstSaveResponse.next({
      ...config,
      workspaceId: workspace.workspaceId,
      appInstanceId: workspace.appInstanceId,
      revision: 5,
    });
    fixture.detectChanges();

    expect(component.isDirty).toBe(false);
  });

  it('keeps the editor dirty after a save failure', () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Unsent title' });
    component.save();

    firstSaveResponse.error(new Error('network offline'));
    fixture.detectChanges();

    expect(component.isDirty).toBe(true);
  });

  it('cancels an in-flight save when destroyed without owning navigation confirmation', () => {
    const cancelPendingSave = jest.spyOn(component.store, 'cancelPendingSave');
    component.onBlockSelected('hero-1');
    component.onFieldChanged({
      key: 'title',
      value: 'Unsaved before teardown',
    });
    component.save();

    fixture.destroy();

    expect(cancelPendingSave).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  });

  it('cancels a deferred save before an accepted unavailable scope change', async () => {
    component.onBlockSelected('hero-1');
    component.onFieldChanged({ key: 'title', value: 'Old scope draft' });
    component.save();

    expect(component.store.saving()).toBe(true);
    const selectedBeforeChange = component.store.selected();

    discoveredWorkspaces.set([]);
    routeParams.next(
      new Map([
        ['workspaceSlug', 'south-star'],
        ['configId', 'config-2'],
      ]) as unknown as ParamMap
    );
    fixture.detectChanges();
    navigationConfirmation.resolve(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.state).toBe('unavailable');
    expect(component.store.saving()).toBe(false);
    expect(component.store.draft()).toBeNull();
    expect(component.store.saveError()).toBeNull();
    expect(component.store.saveConflict()).toBe(false);

    firstSaveResponse.next({
      ...config,
      description: 'Late old-scope save response',
      revision: 5,
      workspaceId: workspace.workspaceId,
      appInstanceId: workspace.appInstanceId,
    });

    expect(component.store.selected()).toBe(selectedBeforeChange);
    expect(component.store.draft()).toBeNull();
    expect(component.store.saveError()).toBeNull();
    expect(component.store.saveConflict()).toBe(false);
  });

  it.each([
    [
      'success',
      5,
      (response: Subject<AppConfiguration>) =>
        response.next({
          ...config,
          workspaceId: workspace.workspaceId,
          appInstanceId: workspace.appInstanceId,
          revision: 5,
        }),
    ],
    [
      'failure',
      4,
      (response: Subject<AppConfiguration>) =>
        response.error(new Error('network offline')),
    ],
  ] as const)(
    'preserves a newer editor draft after the first save %s and stages it on retry',
    (_outcome, expectedRevision, deliverResponse) => {
      component.onBlockSelected('hero-1');
      component.onFieldChanged({ key: 'title', value: 'First save title' });
      component.save();
      component.onFieldChanged({ key: 'title', value: 'Newer local title' });

      deliverResponse(firstSaveResponse);
      fixture.detectChanges();

      expect(component.currentConfig?.landingPage.sections[0].title).toBe(
        'Newer local title'
      );

      component.retrySave();

      expect(api.update).toHaveBeenCalledTimes(2);
      expect(api.update.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          expectedRevision,
          landingPage: expect.objectContaining({
            sections: expect.arrayContaining([
              expect.objectContaining({ title: 'Newer local title' }),
            ]),
          }),
        })
      );
    }
  );
});
