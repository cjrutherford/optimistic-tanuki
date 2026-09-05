import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';

import {
  type AppConfiguration,
  type Section,
  type SectionType,
} from '@optimistic-tanuki/app-config-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

import { AppConfigService } from '../../services/app-config.service';
import { AppConfigDesignerComponent } from './app-config-designer.component';

const baseConfig = (): AppConfiguration => ({
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
        order: 0,
        visible: true,
        title: 'Welcome',
        subtitle: 'Shared canvas',
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
    textColor: '#101010',
    fontFamily: 'Inter, sans-serif',
    customCss: '.a { color: red; }',
  },
  active: true,
  release: {
    status: 'draft',
    history: [],
    publishedVersion: null,
    publishedSnapshot: null,
    previewUrl: 'https://workspace.local',
  },
});

describe('AppConfigDesignerComponent workflows', () => {
  const getConfiguration = jest.fn();
  const createConfiguration = jest.fn();
  const updateConfiguration = jest.fn();
  const publishConfiguration = jest.fn();
  const rollbackConfiguration = jest.fn();
  const navigate = jest.fn();
  const themeService = {
    setTheme: jest.fn(),
    setPrimaryColor: jest.fn(),
    setPersonality: jest.fn().mockResolvedValue(undefined),
    themeColors$: of({
      background: '#ffffff',
      foreground: '#111827',
      accent: '#112233',
    }),
  };

  function mockViewport(matches: boolean) {
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

  function createComponent(
    options: {
      params?: Record<string, string>;
      editorMode?: string;
    } = {}
  ) {
    const params = options.params ?? { id: 'cfg-1' };
    const editorMode = options.editorMode ?? 'studio';

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
            params: of(params),
            snapshot: {
              data: { editorMode, workspaceKind: 'app-config' },
              paramMap: convertToParamMap(params),
            },
          },
        },
        { provide: Router, useValue: { navigate } },
        { provide: ThemeService, useValue: themeService },
      ],
    });

    const fixture = TestBed.createComponent(AppConfigDesignerComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockViewport(false);
    getConfiguration.mockReturnValue(of(baseConfig()));
    createConfiguration.mockReturnValue(of(baseConfig()));
    updateConfiguration.mockReturnValue(of(baseConfig()));
    publishConfiguration.mockReturnValue(of(baseConfig()));
    rollbackConfiguration.mockReturnValue(of(baseConfig()));
  });

  describe('route wiring', () => {
    it('ignores an unrecognised editorMode and keeps the studio default', () => {
      const { component } = createComponent({ editorMode: 'nonsense' });

      expect(component.workspaceMode).toBe('studio');
    });

    it('falls back to the configId input when the route has no id param', () => {
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
              data: of({ editorMode: 'studio' }),
              params: of({}),
              snapshot: {
                data: { editorMode: 'studio' },
                paramMap: convertToParamMap({}),
              },
            },
          },
          { provide: Router, useValue: { navigate } },
          { provide: ThemeService, useValue: themeService },
        ],
      });

      const fixture = TestBed.createComponent(AppConfigDesignerComponent);
      fixture.componentInstance.configId = 'cfg-from-input';
      fixture.detectChanges();

      expect(getConfiguration).toHaveBeenCalledWith('cfg-from-input');
    });

    it('loads nothing when there is neither a route id nor an input id', () => {
      createComponent({ params: {} });

      expect(getConfiguration).not.toHaveBeenCalled();
    });
  });

  describe('guided step navigation', () => {
    it('reports the index of the active tab', () => {
      const { component } = createComponent();

      component.onTabChange('features');
      expect(component.guidedStepIndex()).toBe(2);
    });

    it('moves forward and backward through the tabs', () => {
      const { component } = createComponent();

      component.onTabChange('general');
      component.nextGuidedStep();
      expect(component.selectedTab).toBe('sections');

      component.prevGuidedStep();
      expect(component.selectedTab).toBe('general');
    });

    it('refuses to step outside the tab range', () => {
      const { component } = createComponent();

      component.onTabChange('general');
      component.prevGuidedStep();
      expect(component.selectedTab).toBe('general');

      component.onTabChange('theme');
      component.nextGuidedStep();
      expect(component.selectedTab).toBe('theme');
    });
  });

  describe('theme getters', () => {
    it('exposes the loaded theme values', () => {
      const { component } = createComponent();

      expect(component.customCss).toBe('.a { color: red; }');
      expect(component.customFonts).toBe('Inter, sans-serif');
      expect(component.customText).toBe('#101010');
    });

    it('falls back to empty strings when the theme is missing', () => {
      const { component } = createComponent();

      component.config = { ...component.config, theme: undefined } as never;

      expect(component.customCss).toBe('');
      expect(component.customFonts).toBe('');
      expect(component.customText).toBe('');
    });
  });

  describe('section defaults', () => {
    const types: SectionType[] = [
      'hero',
      'features',
      'content',
      'grid',
      'cta',
      'footer',
    ];

    it.each(types)('creates a default %s section', (type) => {
      const { component } = createComponent();

      const section = component.createDefaultSection(type);

      expect(section.type).toBe(type);
      expect(section.visible).toBe(true);
      expect(section.id.startsWith(`${type}-`)).toBe(true);
    });

    it('rejects an unknown section type', () => {
      const { component } = createComponent();

      expect(() =>
        component.createDefaultSection('mystery' as SectionType)
      ).toThrow('Unknown section type: mystery');
    });

    it('appends the chosen section type to the canvas and closes the selector', () => {
      const { component } = createComponent();

      component.showSectionSelector();
      expect(component.isSectionSelectorVisible).toBe(true);

      component.onSectionTypeSelected('features');

      expect(component.isSectionSelectorVisible).toBe(false);
      expect(
        component.config.landingPage.sections.some((s) => s.type === 'features')
      ).toBe(true);
    });

    it('hides the selector without adding a section', () => {
      const { component } = createComponent();

      component.showSectionSelector();
      component.hideSectionSelector();

      expect(component.isSectionSelectorVisible).toBe(false);
      expect(component.config.landingPage.sections).toHaveLength(2);
    });
  });

  describe('section icons and titles', () => {
    it('maps every known section type to an icon', () => {
      const { component } = createComponent();

      expect(component.getSectionIcon('hero')).toBe('landscape');
      expect(component.getSectionIcon('features')).toBe('stars');
      expect(component.getSectionIcon('content')).toBe('article');
      expect(component.getSectionIcon('grid')).toBe('grid_view');
      expect(component.getSectionIcon('cta')).toBe('campaign');
      expect(component.getSectionIcon('footer')).toBe('footer');
      expect(component.getSectionIcon('mystery' as SectionType)).toBe(
        'extension'
      );
    });

    it('prefers the section title and falls back to a type label', () => {
      const { component } = createComponent();
      const titled = (type: SectionType, title?: string) =>
        component.getSectionTitle({ id: 'x', type, title } as Section);

      expect(titled('hero', 'My hero')).toBe('My hero');
      expect(titled('hero')).toBe('Hero Section');
      expect(titled('features')).toBe('Features Section');
      expect(titled('content')).toBe('Content Section');
      expect(titled('grid')).toBe('Grid Section');
      expect(titled('cta')).toBe('CTA Section');
      expect(titled('footer')).toBe('Footer Section');
      expect(titled('mystery' as SectionType)).toBe('Section');
    });

    it('names canvas blocks after the matching section, falling back to the block type', () => {
      const { component } = createComponent();
      const blocks = component.canvasBlocks();

      expect(component.blockFallbackTitle(blocks[0], 0)).toBe('Welcome');
      expect(component.blockFallbackTitle(blocks[0], 99)).toBe(blocks[0].type);
    });
  });

  describe('section editing', () => {
    it('opens the section editor with a copy of the section', () => {
      const { component } = createComponent();
      const section = component.config.landingPage.sections[0];

      component.editSection(section, 0);

      expect(component.isSectionEditorVisible).toBe(true);
      expect(component.selectedSectionIndex).toBe(0);
      expect(component.selectedSection).toEqual(section);
      expect(component.selectedSection).not.toBe(section);
    });

    it('clears the editor state when hidden', () => {
      const { component } = createComponent();

      component.editSection(component.config.landingPage.sections[0], 0);
      component.hideSectionEditor();

      expect(component.isSectionEditorVisible).toBe(false);
      expect(component.selectedSection).toBeNull();
      expect(component.selectedSectionIndex).toBe(-1);
    });

    it('commits an edited section back onto the canvas and closes the editor', () => {
      const { component } = createComponent();
      const section = {
        ...component.config.landingPage.sections[0],
        title: 'Rewritten hero',
      } as Section;

      component.editSection(section, 0);
      component.onSectionEditorSave(section);

      expect(component.isSectionEditorVisible).toBe(false);
      expect(
        component.config.landingPage.sections.find((s) => s.id === 'hero-1')
      ).toEqual(expect.objectContaining({ title: 'Rewritten hero' }));
    });

    it('toggles section visibility', () => {
      const { component } = createComponent();
      const section = component.config.landingPage.sections[0];

      component.toggleSectionVisibility(section);

      expect(
        component.config.landingPage.sections.find((s) => s.id === 'hero-1')
          ?.visible
      ).toBe(false);
    });

    it('deletes a section once the operator confirms', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const { component } = createComponent();

      component.deleteSection(0);

      expect(component.config.landingPage.sections.map((s) => s.id)).toEqual([
        'cta-1',
      ]);
      confirmSpy.mockRestore();
    });

    it('keeps the section when the operator declines', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const { component } = createComponent();

      component.deleteSection(0);

      expect(component.config.landingPage.sections).toHaveLength(2);
      confirmSpy.mockRestore();
    });

    it('ignores a delete for an index that has no section', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const { component } = createComponent();

      component.deleteSection(42);

      expect(component.config.landingPage.sections).toHaveLength(2);
      confirmSpy.mockRestore();
    });

    it('re-syncs the workspace when section orders are refreshed', () => {
      const { component } = createComponent();

      component.updateSectionOrders();

      expect(component.canvasBlocks().map((b) => b.id)).toEqual([
        'hero-1',
        'cta-1',
      ]);
    });
  });

  describe('drag and drop', () => {
    // KNOWN BUG (pinned, not asserted as desired behaviour): dropping a section
    // onto a new index leaves the canvas order unchanged. `onSectionDrop` calls
    // `moveBlockInWorkspace` (libs/app-config-models/src/lib/app-configuration.model.ts),
    // which splices the block into the target position and then hands the result
    // to `normalizeBlockOrder`. That helper re-sorts by each block's stale
    // `order` field before renumbering, which undoes the splice every time. The
    // same defect makes `moveSelectedBlock` a no-op. Fixing it belongs in the
    // shared lib, so this test records today's behaviour rather than the intent.
    it('resolves the dragged section but currently leaves the order unchanged', () => {
      const { component } = createComponent();

      component.onSectionDrop({
        previousIndex: 0,
        currentIndex: 1,
      } as CdkDragDrop<Section[]>);

      expect(component.canvasBlocks().map((b) => b.id)).toEqual([
        'hero-1',
        'cta-1',
      ]);
    });

    it('ignores a drop that does not map onto a section', () => {
      const { component } = createComponent();

      component.onSectionDrop({
        previousIndex: 99,
        currentIndex: 0,
      } as CdkDragDrop<Section[]>);

      expect(component.canvasBlocks().map((b) => b.id)).toEqual([
        'hero-1',
        'cta-1',
      ]);
    });
  });

  describe('canvas block selection', () => {
    it('returns null selections when nothing is selected', () => {
      const { component } = createComponent();

      expect(component.selectedCanvasBlock()).toBeNull();
      expect(component.selectedBlockDefinition()).toBeNull();
    });

    it('is a no-op to patch, move or remove with no selection', () => {
      const { component } = createComponent();

      component.patchSelectedBlock({ title: 'x' });
      component.moveSelectedBlock(0);
      component.removeSelectedBlock();

      expect(component.canvasBlocks()).toHaveLength(2);
    });

    it('removes the selected block from the canvas', () => {
      const { component } = createComponent();

      component.selectCanvasBlock('hero-1');
      component.removeSelectedBlock();

      expect(component.canvasBlocks().map((b) => b.id)).toEqual(['cta-1']);
      expect(component.selectedBlockId()).toBeNull();
    });
  });

  describe('mobile sheet', () => {
    it('opens in the requested view and closes again', () => {
      const { component } = createComponent();

      component.openMobileSheet('structure');
      expect(component.mobileSheetOpen()).toBe(true);
      expect(component.mobileSheetMode()).toBe('structure');

      component.closeMobileSheet();
      expect(component.mobileSheetOpen()).toBe(false);
    });

    it('falls back to structure when the inspector has no selection', () => {
      const { component } = createComponent();

      component.openMobileSheet('inspector');

      expect(component.mobileSheetMode()).toBe('structure');
      expect(component.mobileSheetTitle()).toBe('Page Structure');
    });

    it('shows the inspector titled by the selected block', () => {
      const { component } = createComponent();

      component.selectCanvasBlock('cta-1');
      component.openMobileSheet('auto');

      expect(component.mobileSheetMode()).toBe('inspector');
      expect(component.mobileSheetTitle()).toBe('Join');
    });

    it('falls back to a generic inspector title when the block has no title', () => {
      const { component } = createComponent();

      component.selectCanvasBlock('cta-1');
      component.patchSelectedBlock({ title: '' });
      component.openMobileSheet('inspector');

      expect(component.mobileSheetTitle()).toBe('Selected Section');
    });
  });

  describe('saving', () => {
    it('creates a new configuration when there is no config id', () => {
      const { component } = createComponent({ params: {} });

      component.config.name = 'Brand new';
      component.onSave();

      expect(createConfiguration).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Brand new' })
      );
      expect(component.statusMessage).toContain('created');
      expect(navigate).toHaveBeenCalledWith(['/dashboard/app-config']);
    });

    it('reports a create failure inline', () => {
      createConfiguration.mockReturnValue(
        throwError(() => new Error('gateway down'))
      );
      const { component } = createComponent({ params: {} });

      component.config.name = 'Brand new';
      component.onSave();

      expect(component.errorMessage).toBe(
        'Failed to save configuration: gateway down'
      );
    });

    it('reports an update failure inline', () => {
      updateConfiguration.mockReturnValue(
        throwError(() => ({ statusText: 'Bad Gateway' }))
      );
      const { component } = createComponent();

      component.onSave();

      expect(component.errorMessage).toBe(
        'Failed to save configuration: Bad Gateway'
      );
    });

    it('describes errors that carry only a message property', () => {
      updateConfiguration.mockReturnValue(
        throwError(() => ({ message: 'plain object failure' }))
      );
      const { component } = createComponent();

      component.onSave();

      expect(component.errorMessage).toBe(
        'Failed to save configuration: plain object failure'
      );
    });

    it('falls back to "Unknown error" for opaque failures', () => {
      updateConfiguration.mockReturnValue(throwError(() => 'nope'));
      const { component } = createComponent();

      component.onSave();

      expect(component.errorMessage).toBe(
        'Failed to save configuration: Unknown error'
      );
    });
  });

  describe('publishing', () => {
    it('refuses to publish an unsaved configuration', () => {
      const { component } = createComponent({ params: {} });

      component.publishConfiguration();

      expect(component.errorMessage).toBe(
        'Save the configuration before publishing it.'
      );
      expect(publishConfiguration).not.toHaveBeenCalled();
    });

    it('requires release notes', () => {
      const { component } = createComponent();

      component.releaseNotes = '   ';
      component.publishConfiguration();

      expect(component.errorMessage).toBe(
        'Release notes are required before publishing.'
      );
      expect(publishConfiguration).not.toHaveBeenCalled();
    });

    it('omits an empty change summary', () => {
      const { component } = createComponent();

      component.releaseNotes = ' Launch ';
      component.changeSummary = '  ';
      component.publishConfiguration();

      expect(publishConfiguration).toHaveBeenCalledWith('cfg-1', {
        releaseNotes: 'Launch',
        changeSummary: undefined,
      });
    });

    it('reports a publish failure inline', () => {
      publishConfiguration.mockReturnValue(
        throwError(() => new Error('publish blew up'))
      );
      const { component } = createComponent();

      component.releaseNotes = 'Launch';
      component.publishConfiguration();

      expect(component.errorMessage).toBe(
        'Failed to publish configuration: publish blew up'
      );
    });
  });

  describe('rollback', () => {
    it('refuses to roll back an unsaved configuration', () => {
      const { component } = createComponent({ params: {} });

      component.rollbackConfiguration(2);

      expect(component.errorMessage).toBe(
        'Save the configuration before rolling it back.'
      );
      expect(rollbackConfiguration).not.toHaveBeenCalled();
    });

    it('confirms a successful rollback', () => {
      const { component } = createComponent();

      component.rollbackConfiguration(2);

      expect(component.statusMessage).toBe(
        'Configuration rolled back to the selected published revision.'
      );
    });

    it('reports a rollback failure inline', () => {
      rollbackConfiguration.mockReturnValue(
        throwError(() => new Error('cannot roll back'))
      );
      const { component } = createComponent();

      component.rollbackConfiguration(2);

      expect(component.errorMessage).toBe(
        'Failed to rollback configuration: cannot roll back'
      );
    });
  });

  describe('cancel', () => {
    it('discards and navigates back once confirmed', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const { component } = createComponent();
      const cancelled = jest.fn();
      component.cancelled.subscribe(cancelled);

      component.onCancel();

      expect(cancelled).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith(['/dashboard/app-config']);
      confirmSpy.mockRestore();
    });

    it('stays put when the operator declines', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const { component } = createComponent();

      component.onCancel();

      expect(navigate).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('release metadata', () => {
    it('labels the release status', () => {
      const { component } = createComponent();

      expect(component.releaseStatusLabel()).toBe('Draft');

      component.config.release = { status: 'published' } as never;
      expect(component.releaseStatusLabel()).toBe('Published');

      component.config.release = { status: 'changes-pending' } as never;
      expect(component.releaseStatusLabel()).toBe('Changes Pending');
    });

    it('sorts release history newest first without mutating the source', () => {
      const { component } = createComponent();
      const history = [
        { version: 1 },
        { version: 3 },
        { version: 2 },
      ] as never[];
      component.config.release = { status: 'published', history } as never;

      expect(component.releaseHistory().map((r) => r.version)).toEqual([
        3, 2, 1,
      ]);
      expect(history.map((r: { version: number }) => r.version)).toEqual([
        1, 3, 2,
      ]);
    });

    it('exposes the preview url and null when unset', () => {
      const { component } = createComponent();

      expect(component.previewUrl()).toBe('https://workspace.local');

      component.config.release = { status: 'draft' } as never;
      expect(component.previewUrl()).toBeNull();
    });
  });

  describe('loading', () => {
    it('carries release notes and change summary from the loaded config', () => {
      const config = baseConfig();
      config.release = {
        ...config.release,
        releaseNotes: 'Prior notes',
        changeSummary: 'Prior summary',
      } as never;
      getConfiguration.mockReturnValue(of(config));

      const { component } = createComponent();

      expect(component.releaseNotes).toBe('Prior notes');
      expect(component.changeSummary).toBe('Prior summary');
    });
  });
});
