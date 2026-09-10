import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { type AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { AppConfigService } from '../../services/app-config.service';
import { BlogCatalogService } from '../../services/blog-catalog.service';
import { AppConfigDesignerComponent } from './app-config-designer.component';

describe('AppConfigDesignerComponent', () => {
  const getConfiguration = jest.fn();
  const createConfiguration = jest.fn();
  const updateConfiguration = jest.fn();
  const publishConfiguration = jest.fn();
  const rollbackConfiguration = jest.fn();
  const navigate = jest.fn();
  const setTheme = jest.fn();
  const setPrimaryColor = jest.fn();
  const setPersonality = jest.fn().mockResolvedValue(undefined);
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#111827',
    accent: '#112233',
  });
  const getMyCatalogs = jest.fn();

  function mockMobileViewport(matches: boolean) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches,
        media: '(max-width: 768px)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  const loadedConfig: AppConfiguration = {
    id: 'cfg-1',
    revision: 7,
    name: 'Workspace Config',
    description: 'Shared workspace test',
    domain: 'workspace.local',
    landingPage: {
      layout: 'single-column',
      sections: [
        {
          id: 'hero-1',
          type: 'hero',
          order: 3,
          visible: true,
          title: 'Welcome',
          subtitle: 'Shared canvas',
          background: {
            sourceType: 'asset',
            src: '/assets/hero-default.jpg',
            alt: 'Hero background',
            aspect: 'landscape',
            fit: 'cover',
            focalPoint: 'center',
          },
          motion: {
            kind: 'none',
          },
        },
        {
          id: 'cta-1',
          type: 'cta',
          order: 1,
          visible: true,
          title: 'Join',
          buttonText: 'Start',
          buttonLink: '/start',
        },
      ],
    },
    routes: [],
    features: {
      social: { enabled: false },
      tasks: { enabled: false },
      blogging: {
        enabled: false,
        allowComments: false,
        moderateComments: false,
      },
      projectPlanning: {
        enabled: false,
        showGantt: false,
        showKanban: false,
        allowRisks: false,
      },
    },
    theme: {
      mode: 'light',
      personalityId: 'foundation',
      primaryColor: '#112233',
      secondaryColor: '#445566',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontFamily: 'Roboto, sans-serif',
      customCss: '',
    },
    active: true,
    release: {
      status: 'draft',
      history: [],
      publishedVersion: null,
      publishedSnapshot: null,
      previewUrl: 'https://workspace.local',
    },
  };

  function createComponent(editorMode: 'guided' | 'studio' = 'guided') {
    getConfiguration.mockReturnValue(
      of(JSON.parse(JSON.stringify(loadedConfig)) as AppConfiguration)
    );
    createConfiguration.mockReturnValue(of({ ...loadedConfig }));
    updateConfiguration.mockReturnValue(of({ ...loadedConfig }));
    publishConfiguration.mockReturnValue(
      of({
        ...loadedConfig,
        release: {
          ...loadedConfig.release,
          status: 'published',
          publishedVersion: 1,
          releaseNotes: 'Launch ready',
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'Launch ready',
              changeSummary: 'Launch summary',
              snapshot: {},
            },
          ],
        },
      })
    );
    rollbackConfiguration.mockReturnValue(of({ ...loadedConfig }));
    getMyCatalogs.mockReturnValue(
      of([
        {
          id: 'blog-catalog-north',
          name: 'North journal',
          ownerId: 'profile-1',
          workspaceId: 'workspace-1',
          appScope: 'business-site',
        },
      ])
    );

    TestBed.configureTestingModule({
      imports: [AppConfigDesignerComponent],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            getConfiguration,
            createConfiguration,
            updateConfiguration,
            publishConfiguration,
            rollbackConfiguration,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ editorMode, workspaceKind: 'app-config' }),
            params: of({ id: 'cfg-1' }),
            snapshot: {
              data: { editorMode, workspaceKind: 'app-config' },
              paramMap: convertToParamMap({ id: 'cfg-1' }),
              queryParamMap: convertToParamMap({ slug: 'north-site' }),
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setTheme,
            setPrimaryColor,
            setPersonality,
            themeColors$,
          },
        },
        {
          provide: BlogCatalogService,
          useValue: { getMyCatalogs },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppConfigDesignerComponent);
    fixture.detectChanges();

    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockMobileViewport(false);
  });

  it('persists a workspace-owned Blog catalog as the blogging capability resource', () => {
    const { component } = createComponent();

    component.selectBlogCatalog('blog-catalog-north');
    component.patchSelectedBlock({ title: 'Edited after catalog selection' });

    expect(getMyCatalogs).toHaveBeenCalledWith('north-site');
    expect(component.config.manifest).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        surfaceType: 'business-site',
        capabilities: expect.objectContaining({
          'blogging.posts': expect.objectContaining({
            enabled: true,
            resourceRef: {
              type: 'blog-catalog',
              id: 'blog-catalog-north',
            },
            settings: { catalogId: 'blog-catalog-north' },
          }),
        }),
      })
    );
  });

  it('uses the same shared canvas in guided and studio modes', () => {
    const { fixture, component } = createComponent('guided');
    const host = fixture.nativeElement as HTMLElement;

    expect(component.workspaceMode).toBe('guided');
    expect(host.querySelector('[data-shared-canvas]')).toBeTruthy();

    component.setWorkspaceMode('studio');
    fixture.detectChanges();

    expect(component.workspaceMode).toBe('studio');
    expect(host.querySelector('[data-shared-canvas]')).toBeTruthy();
  });

  it('renders a persistent landing-page preview beside the editor surface', () => {
    const { fixture, component } = createComponent('guided');
    const host = fixture.nativeElement as HTMLElement;

    component.onTabChange('theme');
    component.selectCanvasBlock('cta-1');
    fixture.detectChanges();

    expect(host.querySelector('app-editor-block-tree')).toBeTruthy();
    expect(host.querySelector('app-schema-block-inspector')).toBeTruthy();
    expect(host.querySelector('[data-rendered-preview]')).toBeTruthy();
    expect(host.querySelector('[data-design-system-panel]')).toBeTruthy();
    expect(host.querySelector('app-landing-page')).toBeTruthy();
  });

  it('renders shared block tree cards with title and type metadata', () => {
    const { fixture } = createComponent('guided');
    const host = fixture.nativeElement as HTMLElement;
    const firstCard = host.querySelector(
      '[data-block-tree] .canvas-block-card'
    ) as HTMLElement;

    expect(firstCard).toBeTruthy();
    expect(
      firstCard.querySelector('[data-block-index]')?.textContent
    ).toContain('1');
    expect(
      firstCard.querySelector('[data-block-title]')?.textContent
    ).toContain('Join');
    expect(firstCard.querySelector('[data-block-type]')?.textContent).toContain(
      'cta'
    );
  });

  it('round-trips section edits through the shared config document workspace', () => {
    const { component } = createComponent('studio');

    component.selectCanvasBlock('cta-1');
    component.patchSelectedBlock({
      title: 'Join today',
      buttonText: 'Launch',
      buttonLink: '/launch',
    });
    component.moveSelectedBlock(0);

    expect(component.selectedBlockId()).toBe('cta-1');
    expect(
      component.workspaceDocument().blocks.map((block) => block.id)
    ).toEqual(['cta-1', 'hero-1']);
    expect(component.config.landingPage.sections).toEqual([
      expect.objectContaining({
        id: 'cta-1',
        order: 0,
        title: 'Join today',
        buttonText: 'Launch',
        buttonLink: '/launch',
      }),
      expect.objectContaining({
        id: 'hero-1',
        order: 1,
      }),
    ]);
  });

  it('round-trips a schema collection into the rendered grid draft', () => {
    const { component } = createComponent('studio');
    component.config = {
      ...component.config,
      landingPage: {
        ...component.config.landingPage,
        sections: [
          {
            id: 'grid-1',
            type: 'grid',
            order: 0,
            visible: true,
            title: 'Resources',
            columns: 3,
            items: [],
          },
        ],
      },
    };
    component['syncWorkspaceFromConfig']();
    component.selectCanvasBlock('grid-1');

    component.patchSelectedCollection('items', [
      {
        title: 'Getting started',
        description: 'A practical guide',
        link: '/guide',
      },
    ]);

    expect(component.config.landingPage.sections[0]).toEqual(
      expect.objectContaining({
        type: 'grid',
        items: [
          {
            title: 'Getting started',
            description: 'A practical guide',
            link: '/guide',
          },
        ],
      })
    );
  });

  it('updates the rendered preview and theme service immediately from draft edits', () => {
    const { fixture, component } = createComponent('studio');
    const host = fixture.nativeElement as HTMLElement;

    component.selectCanvasBlock('cta-1');
    component.patchSelectedBlock({
      title: 'Join today',
      buttonText: 'Launch',
      buttonLink: '/launch',
    });
    component.updateThemeField('primaryColor', '#0f766e');
    fixture.detectChanges();

    expect(host.textContent).toContain('Join today');
    expect(setPrimaryColor).toHaveBeenLastCalledWith('#0f766e');
  });

  it('marks workspace edits as unsaved until a successful draft save', () => {
    const { component } = createComponent('studio');

    expect(component.isDirty()).toBe(false);

    component.selectCanvasBlock('cta-1');
    component.patchSelectedBlock({ title: 'Changed draft' });

    expect(component.isDirty()).toBe(true);

    component.onSave();

    expect(component.isDirty()).toBe(false);
  });

  it('blocks route deactivation and browser unload while a draft is dirty', () => {
    const { component } = createComponent('studio');
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    component.selectCanvasBlock('cta-1');
    component.patchSelectedBlock({ title: 'Changed draft' });
    const unloadEvent = new Event('beforeunload', { cancelable: true });

    expect(component.canDeactivate()).toBe(false);

    component.onBeforeUnload(unloadEvent as BeforeUnloadEvent);

    expect(confirmSpy).toHaveBeenCalled();
    expect(unloadEvent.defaultPrevented).toBe(true);
  });

  it('publishes a configuration with release notes and returns to the list', () => {
    const { component } = createComponent('studio');

    component.releaseNotes = 'Launch ready';
    component.changeSummary = 'Launch summary';
    component.publishConfiguration();

    expect(publishConfiguration).toHaveBeenCalledWith('cfg-1', {
      expectedRevision: 7,
      releaseNotes: 'Launch ready',
      changeSummary: 'Launch summary',
    });
    expect(component.statusMessage).toContain('published');
    expect(navigate).toHaveBeenCalledWith(['/dashboard/app-config']);
  });

  it('rolls back to a selected revision from release history', () => {
    const { component } = createComponent('studio');
    component.config = {
      ...component.config,
      release: {
        status: 'published',
        publishedVersion: 2,
        publishedSnapshot: null,
        previewUrl: 'https://workspace.local',
        history: [
          {
            version: 2,
            action: 'publish',
            releaseNotes: 'Second release',
            changeSummary: 'Changed hero',
            snapshot: {},
          },
        ],
      },
    } as any;

    component.rollbackConfiguration(2);

    expect(rollbackConfiguration).toHaveBeenCalledWith('cfg-1', {
      expectedRevision: 7,
      version: 2,
      releaseNotes: 'Rollback from owner console',
    });
  });

  it('drives theme-lib for mode and personality changes from the design workspace', () => {
    const { component } = createComponent('studio');

    component.updateThemeField('mode', 'dark');
    component.updateThemeField('personalityId', 'electric');

    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(setPersonality).toHaveBeenLastCalledWith('electric');
  });

  it('lets the rendered preview drive block selection', () => {
    const { fixture, component } = createComponent('studio');
    const host = fixture.nativeElement as HTMLElement;

    const previewSection = host.querySelector(
      '[data-section-id="cta-1"]'
    ) as HTMLElement;

    previewSection.click();
    fixture.detectChanges();

    expect(component.selectedBlockId()).toBe('cta-1');
    expect(previewSection.classList.contains('preview-section-selected')).toBe(
      true
    );
  });

  it('opens the contextual mobile sheet in inspector mode after selecting from preview', () => {
    mockMobileViewport(true);
    const { fixture, component } = createComponent('studio');
    const host = fixture.nativeElement as HTMLElement;

    const previewSection = host.querySelector(
      '[data-section-id="cta-1"]'
    ) as HTMLElement;

    previewSection.click();
    fixture.detectChanges();

    expect(host.querySelector('[data-mobile-editor-sheet]')).toBeTruthy();
    expect(
      host.querySelector(
        '[data-mobile-editor-sheet] app-schema-block-inspector'
      )
    ).toBeTruthy();
  });

  it('drives explicit theme mode and personality through theme-lib', () => {
    const { component } = createComponent('studio');

    component.updateThemeField('mode', 'dark');
    component.updateThemeField('personalityId', 'bold');

    expect(setTheme).toHaveBeenLastCalledWith('dark');
    expect(setPersonality).toHaveBeenLastCalledWith('bold');
  });

  it('supports nested motion and media field editing through the shared inspector workflow', () => {
    const { fixture, component } = createComponent('studio');

    component.selectCanvasBlock('hero-1');
    component.patchSelectedField('motion.kind', 'particle-veil');
    component.patchSelectedField('motion.speed', '1.4');
    component.patchSelectedField('background.src', '/assets/hero-rich.jpg');
    component.patchSelectedField(
      'background.alt',
      'Atmospheric hero background'
    );
    fixture.detectChanges();

    const hero = component.config.landingPage.sections.find(
      (section) => section.id === 'hero-1'
    );

    expect(hero).toEqual(
      expect.objectContaining({
        motion: expect.objectContaining({
          kind: 'particle-veil',
          speed: 1.4,
        }),
        background: expect.objectContaining({
          src: '/assets/hero-rich.jpg',
          alt: 'Atmospheric hero background',
        }),
      })
    );
  });

  it('exposes richer motion and media fields in the shared generic inspector definitions', () => {
    const { component } = createComponent('studio');

    component.selectCanvasBlock('hero-1');

    expect(component.selectedBlockDefinition()?.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'motion.kind', type: 'select' }),
        expect.objectContaining({ key: 'background.src' }),
        expect.objectContaining({ key: 'background.fit', type: 'select' }),
      ])
    );
  });

  it('renders embedded preview sections with motion/media metadata visible in the generic preview', () => {
    const { fixture, component } = createComponent('studio');
    const host = fixture.nativeElement as HTMLElement;

    component.selectCanvasBlock('hero-1');
    component.patchSelectedBlock({
      motion: {
        kind: 'aurora-ribbon',
        density: 3,
      },
      background: {
        sourceType: 'asset',
        src: '/assets/preview-hero.jpg',
        alt: 'Preview hero',
        fit: 'cover',
        focalPoint: 'top',
      },
    });
    fixture.detectChanges();

    const previewSection = host.querySelector(
      '[data-section-id="hero-1"]'
    ) as HTMLElement;
    const heroBackground = previewSection.querySelector(
      '.hero-background'
    ) as HTMLElement;

    expect(previewSection).toBeTruthy();
    expect(previewSection.getAttribute('data-motion-kind')).toBe(
      'aurora-ribbon'
    );
    expect(heroBackground?.style.backgroundImage).toContain(
      '/assets/preview-hero.jpg'
    );
  });

  it('shows an inline validation error instead of using alert when saving without a name', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { component } = createComponent('guided');

    component.config.name = '';
    component.onSave();

    expect(component.errorMessage).toBe(
      'Provide a configuration name before saving.'
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows an inline success message after saving an existing configuration', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { component } = createComponent('studio');

    component.onSave();

    expect(updateConfiguration).toHaveBeenCalledWith(
      'cfg-1',
      expect.objectContaining({ name: 'Workspace Config' })
    );
    expect(component.statusMessage).toBe(
      'Configuration saved. Returning to the configuration list…'
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('sends the loaded revision as the expected revision when updating', () => {
    const { component } = createComponent('studio');

    component.onSave();

    expect(updateConfiguration).toHaveBeenCalledWith(
      'cfg-1',
      expect.objectContaining({ expectedRevision: 7 })
    );
  });

  it('sends the loaded revision as the expected revision when publishing', () => {
    const { component } = createComponent('studio');

    component.releaseNotes = 'Launch ready';
    component.publishConfiguration();

    expect(publishConfiguration).toHaveBeenCalledWith('cfg-1', {
      releaseNotes: 'Launch ready',
      changeSummary: undefined,
      expectedRevision: 7,
    });
  });

  it('sends the loaded revision as the expected revision when rolling back', () => {
    const { component } = createComponent('studio');

    component.rollbackConfiguration(2);

    expect(rollbackConfiguration).toHaveBeenCalledWith('cfg-1', {
      version: 2,
      releaseNotes: 'Rollback from owner console',
      expectedRevision: 7,
    });
  });

  it.each(['save', 'publish', 'rollback'] as const)(
    'preserves revision 0 for %s mutations',
    (action) => {
      const { component } = createComponent('studio');
      component.config = { ...component.config, revision: 0 };

      if (action === 'save') {
        component.onSave();
        expect(updateConfiguration).toHaveBeenCalledWith(
          'cfg-1',
          expect.objectContaining({ expectedRevision: 0 })
        );
      } else if (action === 'publish') {
        component.releaseNotes = 'Launch ready';
        component.publishConfiguration();
        expect(publishConfiguration).toHaveBeenCalledWith(
          'cfg-1',
          expect.objectContaining({ expectedRevision: 0 })
        );
      } else {
        component.rollbackConfiguration(2);
        expect(rollbackConfiguration).toHaveBeenCalledWith(
          'cfg-1',
          expect.objectContaining({ expectedRevision: 0 })
        );
      }
    }
  );

  it.each([
    ['save', undefined],
    ['publish', -1],
    ['rollback', 1.5],
  ] as const)(
    'blocks %s when the loaded revision is invalid',
    (action, revision) => {
      const { component } = createComponent('studio');
      component.config = { ...component.config, revision };

      if (action === 'save') {
        component.onSave();
      } else if (action === 'publish') {
        component.releaseNotes = 'Launch ready';
        component.publishConfiguration();
      } else {
        component.rollbackConfiguration(2);
      }

      expect(updateConfiguration).not.toHaveBeenCalled();
      expect(publishConfiguration).not.toHaveBeenCalled();
      expect(rollbackConfiguration).not.toHaveBeenCalled();
      expect(component.errorMessage).toContain(
        'valid nonnegative integer revision'
      );
      expect(component.errorMessage).toContain(
        'Reload the latest configuration'
      );
    }
  );

  it('preserves a dirty local draft and offers reload after a revision conflict', () => {
    const { fixture, component } = createComponent('studio');
    component.selectCanvasBlock('cta-1');
    component.patchSelectedBlock({ title: 'Local draft' });
    updateConfiguration.mockReturnValueOnce(
      throwError(() => ({ status: 409, statusText: 'Conflict' }))
    );

    component.onSave();
    fixture.detectChanges();

    expect(component.config.landingPage.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Local draft' }),
      ])
    );
    expect(component.errorMessage).toContain('reload the latest configuration');
    expect(
      fixture.nativeElement.querySelector('[data-reload-latest]')
    ).toBeTruthy();
  });

  it('reloads the latest configuration when the owner chooses to do so', () => {
    const { component } = createComponent('studio');

    component.reloadLatestConfiguration();

    expect(getConfiguration).toHaveBeenCalledWith('cfg-1');
  });

  it('shows an inline error when loading an existing configuration fails', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    getConfiguration.mockReturnValue(
      throwError(() => new Error('Service unavailable'))
    );

    TestBed.configureTestingModule({
      imports: [AppConfigDesignerComponent],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            getConfiguration,
            createConfiguration,
            updateConfiguration,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ editorMode: 'guided', workspaceKind: 'app-config' }),
            params: of({ id: 'cfg-1' }),
            snapshot: {
              data: { editorMode: 'guided', workspaceKind: 'app-config' },
              paramMap: convertToParamMap({ id: 'cfg-1' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            setTheme,
            setPrimaryColor,
            setPersonality,
            themeColors$,
          },
        },
        {
          provide: BlogCatalogService,
          useValue: { getMyCatalogs },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppConfigDesignerComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.errorMessage).toBe(
      'Failed to load configuration: Service unavailable'
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});
