import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { type AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { AppConfigService } from '../../services/app-config.service';
import { AppConfigDesignerComponent } from './app-config-designer.component';

describe('AppConfigDesignerComponent', () => {
  const getConfiguration = jest.fn();
  const createConfiguration = jest.fn();
  const updateConfiguration = jest.fn();
  const navigate = jest.fn();
  const setTheme = jest.fn();
  const setPrimaryColor = jest.fn();
  const setPersonality = jest.fn().mockResolvedValue(undefined);
  const themeColors$ = of({
    background: '#ffffff',
    foreground: '#111827',
    accent: '#112233',
  });

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
  };

  function createComponent(editorMode: 'guided' | 'studio' = 'guided') {
    getConfiguration.mockReturnValue(
      of(JSON.parse(JSON.stringify(loadedConfig)) as AppConfiguration)
    );
    createConfiguration.mockReturnValue(of({ ...loadedConfig }));
    updateConfiguration.mockReturnValue(of({ ...loadedConfig }));

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
            data: of({ editorMode, workspaceKind: 'app-config' }),
            params: of({ id: 'cfg-1' }),
            snapshot: {
              data: { editorMode, workspaceKind: 'app-config' },
              paramMap: convertToParamMap({ id: 'cfg-1' }),
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

    expect(component.mobileSheetOpen()).toBe(true);
    expect(component.mobileSheetMode()).toBe('inspector');
    expect(host.querySelector('[data-mobile-sheet]')).toBeTruthy();
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
});
