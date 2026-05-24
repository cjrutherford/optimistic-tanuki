import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TabsComponent,
  IconComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import {
  TextInputComponent,
  TextAreaComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import {
  APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS,
  AppConfiguration,
  BlockDefinition,
  BlockInstance,
  ConfigDocument,
  Section,
  SectionType,
  HeroSection,
  FeaturesSection,
  ContentSection,
  GridSection,
  CTASection,
  FooterSection,
  appConfigToConfigDocument,
  configDocumentToAppConfig,
  createEditorWorkspace,
  insertBlockInWorkspace,
  moveBlockInWorkspace,
  removeBlockFromWorkspace,
  sectionToBlockInstance,
  selectBlockInWorkspace,
  updateBlockInWorkspace,
} from '@optimistic-tanuki/app-config-models';
import {
  ConfigurableLandingPageComponent,
  EditorBlockTreeComponent,
  EditorDesignSystemPanelComponent,
  SchemaBlockInspectorComponent,
} from '@optimistic-tanuki/configurable-client-ui';
import { AppConfigService } from '../../services/app-config.service';
import { SectionSelectorComponent } from './section-editors/section-selector.component';
import { SectionEditorComponent } from './section-editors/section-editor.component';

/**
 * App Configuration Designer Component
 *
 * Visual designer interface for creating and editing application configurations.
 * Features drag-and-drop section management, theme customization, and feature toggles.
 */
@Component({
  selector: 'app-config-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TabsComponent,
    IconComponent,
    DragDropModule,
    ButtonComponent,
    CardComponent,
    ConfigurableLandingPageComponent,
    EditorBlockTreeComponent,
    EditorDesignSystemPanelComponent,
    SchemaBlockInspectorComponent,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
    SectionSelectorComponent,
    SectionEditorComponent,
  ],
  templateUrl: './app-config-designer.component.html',
  styleUrls: ['./app-config-designer.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AppConfigDesignerComponent implements OnInit {
  @Input() configId?: string;
  @Output() saved = new EventEmitter<AppConfiguration>();
  @Output() cancelled = new EventEmitter<void>();

  workspaceMode: 'guided' | 'studio' = 'studio';
  selectedTab = 'general';

  tabs = [
    { id: 'general', label: 'General' },
    { id: 'sections', label: 'Sections' },
    { id: 'features', label: 'Features' },
    { id: 'theme', label: 'Design' },
  ];

  readonly blockDefinitions = APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS;

  config: Omit<AppConfiguration, 'id'> = {
    name: '',
    description: '',
    domain: '',
    landingPage: {
      sections: [],
      layout: 'single-column',
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
      personalityId: 'professional',
      primaryColor: '#3f51b5',
      secondaryColor: '#ff4081',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontFamily: 'Roboto, sans-serif',
      customCss: '',
    },
    active: true,
  };

  isSectionSelectorVisible = false;
  isSectionEditorVisible = false;
  selectedSection: Section | null = null;
  selectedSectionIndex = -1;
  readonly selectedBlockId = signal<string | null>(null);
  readonly workspaceDocument = signal<ConfigDocument>({
    layout: 'single-column',
    blocks: [],
  });
  readonly mobileSheetOpen = signal(false);
  readonly mobileSheetView = signal<'auto' | 'structure' | 'inspector'>('auto');

  constructor(
    private appConfigService: AppConfigService,
    private route: ActivatedRoute,
    private router: Router,
    private themeService: ThemeService
  ) {}

  ngOnInit(): void {
    this.syncThemePreview();

    this.route.data.subscribe((data) => {
      const editorMode = data['editorMode'];
      if (editorMode === 'guided' || editorMode === 'studio') {
        this.workspaceMode = editorMode;
      }
    });

    // Check for route parameter first
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.configId = id;
        this.loadConfiguration(id);
      } else if (this.configId) {
        // Fallback to input property
        this.loadConfiguration(this.configId);
      }
    });
  }

  onTabChange(tabId: string): void {
    this.selectedTab = tabId;
  }

  setWorkspaceMode(mode: 'guided' | 'studio'): void {
    this.workspaceMode = mode;
  }

  guidedStepIndex(): number {
    return this.tabs.findIndex((tab) => tab.id === this.selectedTab);
  }

  selectGuidedStep(index: number): void {
    const nextTab = this.tabs[index];
    if (nextTab) {
      this.selectedTab = nextTab.id;
    }
  }

  nextGuidedStep(): void {
    this.selectGuidedStep(this.guidedStepIndex() + 1);
  }

  prevGuidedStep(): void {
    this.selectGuidedStep(this.guidedStepIndex() - 1);
  }

  get customCss(): string {
    return this.config.theme?.customCss || '';
  }

  get customFonts(): string {
    return this.config.theme?.fontFamily || '';
  }

  get customText(): string {
    return this.config.theme?.textColor || '';
  }

  updateThemeField<K extends keyof NonNullable<AppConfiguration['theme']>>(
    field: K,
    value: NonNullable<AppConfiguration['theme']>[K]
  ): void {
    this.config = {
      ...this.config,
      theme: {
        ...this.config.theme,
        [field]: value,
      },
    };
    this.syncThemePreview();
  }

  canvasBlocks(): BlockInstance[] {
    return this.workspaceDocument().blocks;
  }

  selectedCanvasBlock(): BlockInstance | null {
    return (
      this.workspaceDocument().blocks.find(
        (block) => block.id === this.selectedBlockId()
      ) ?? null
    );
  }

  selectedBlockDefinition(): BlockDefinition | null {
    const selectedBlock = this.selectedCanvasBlock();
    if (!selectedBlock) {
      return null;
    }

    return this.blockDefinitions[selectedBlock.type as SectionType] ?? null;
  }

  patchSelectedField(fieldKey: string, value: unknown): void {
    this.patchSelectedBlock({
      [fieldKey]: value,
    });
  }

  blockFallbackTitle(block: BlockInstance, index: number): string {
    const section = this.config.landingPage.sections[index];
    if (!section) {
      return block.type;
    }

    return this.getSectionTitle(section);
  }

  loadConfiguration(id: string): void {
    console.log('[AppConfigDesigner] Loading configuration:', id);
    this.appConfigService.getConfiguration(id).subscribe({
      next: (config) => {
        console.log('[AppConfigDesigner] Loaded configuration:', config);
        this.config = config;
        this.syncWorkspaceFromConfig();
        this.syncThemePreview();
      },
      error: (err) => {
        console.error('[AppConfigDesigner] Failed to load configuration:', err);
        alert(
          `Failed to load configuration: ${
            err.message || err.statusText || 'Unknown error'
          }`
        );
      },
    });
  }

  // Section Management
  onSectionDrop(event: CdkDragDrop<Section[]>): void {
    const section = this.config.landingPage?.sections?.[event.previousIndex];
    if (!section) {
      return;
    }

    const workspace = moveBlockInWorkspace(
      this.currentWorkspace(),
      section.id,
      event.currentIndex
    );
    this.commitWorkspace(workspace);
  }

  updateSectionOrders(): void {
    this.syncWorkspaceFromConfig();
  }

  showSectionSelector(): void {
    this.isSectionSelectorVisible = true;
  }

  hideSectionSelector(): void {
    this.isSectionSelectorVisible = false;
  }

  onSectionTypeSelected(sectionType: SectionType): void {
    const newSection = this.createDefaultSection(sectionType);
    const workspace = insertBlockInWorkspace(
      this.currentWorkspace(),
      {},
      sectionToBlockInstance(newSection),
      { renderContext: 'landing-page' }
    );
    this.commitWorkspace(workspace);
    this.hideSectionSelector();
  }

  createDefaultSection(type: SectionType): Section {
    const baseSection = {
      id: `${type}-${Date.now()}`,
      type,
      order: this.config.landingPage?.sections?.length || 0,
      visible: true,
    };

    switch (type) {
      case 'hero':
        return {
          ...baseSection,
          type: 'hero',
          title: 'Welcome',
          subtitle: '',
          backgroundImage: '',
          ctaText: '',
          ctaLink: '',
        } as HeroSection;
      case 'features':
        return {
          ...baseSection,
          type: 'features',
          title: 'Features',
          features: [],
        } as FeaturesSection;
      case 'content':
        return {
          ...baseSection,
          type: 'content',
          title: '',
          content: '',
          imageUrl: '',
          imagePosition: 'left',
        } as ContentSection;
      case 'grid':
        return {
          ...baseSection,
          type: 'grid',
          title: '',
          columns: 3,
          items: [],
        } as GridSection;
      case 'cta':
        return {
          ...baseSection,
          type: 'cta',
          title: 'Call to Action',
          description: '',
          buttonText: 'Get Started',
          buttonLink: '#',
        } as CTASection;
      case 'footer':
        return {
          ...baseSection,
          type: 'footer',
          content: '',
          links: [],
        } as FooterSection;
      default:
        throw new Error(`Unknown section type: ${type}`);
    }
  }

  editSection(section: Section, index: number): void {
    this.selectedSection = { ...section };
    this.selectedSectionIndex = index;
    this.isSectionEditorVisible = true;
  }

  deleteSection(index: number): void {
    if (
      this.config.landingPage?.sections &&
      confirm('Are you sure you want to delete this section?')
    ) {
      const section = this.config.landingPage.sections[index];
      if (!section) {
        return;
      }

      const workspace = removeBlockFromWorkspace(
        this.currentWorkspace(),
        section.id
      );
      this.commitWorkspace(workspace);
    }
  }

  toggleSectionVisibility(section: Section): void {
    const workspace = updateBlockInWorkspace(
      this.currentWorkspace(),
      section.id,
      {
        enabled: !section.visible,
      }
    );
    this.commitWorkspace(workspace);
  }

  onSectionEditorSave(updatedSection: Section): void {
    const workspace = updateBlockInWorkspace(
      this.currentWorkspace(),
      updatedSection.id,
      sectionToBlockInstance(updatedSection)
    );
    this.commitWorkspace(workspace);
    this.hideSectionEditor();
  }

  hideSectionEditor(): void {
    this.isSectionEditorVisible = false;
    this.selectedSection = null;
    this.selectedSectionIndex = -1;
  }

  getSectionIcon(type: SectionType): string {
    const icons: Record<SectionType, string> = {
      hero: 'landscape',
      features: 'stars',
      content: 'article',
      grid: 'grid_view',
      cta: 'campaign',
      footer: 'footer',
    };
    return icons[type] || 'extension';
  }

  getSectionTitle(section: Section): string {
    switch (section.type) {
      case 'hero':
        return (section as HeroSection).title || 'Hero Section';
      case 'features':
        return (section as FeaturesSection).title || 'Features Section';
      case 'content':
        return (section as ContentSection).title || 'Content Section';
      case 'grid':
        return (section as GridSection).title || 'Grid Section';
      case 'cta':
        return (section as CTASection).title || 'CTA Section';
      case 'footer':
        return 'Footer Section';
      default:
        return 'Section';
    }
  }

  selectCanvasBlock(blockId: string): void {
    const workspace = selectBlockInWorkspace(this.currentWorkspace(), blockId);
    this.commitWorkspace(workspace);
    if (this.isMobileViewport()) {
      this.openMobileSheet('inspector');
    }
  }

  patchSelectedBlock(patch: Record<string, unknown>): void {
    const selectedBlock = this.selectedCanvasBlock();
    if (!selectedBlock) {
      return;
    }

    const workspace = updateBlockInWorkspace(
      this.currentWorkspace(),
      selectedBlock.id,
      { data: patch }
    );
    this.commitWorkspace(workspace);
  }

  moveSelectedBlock(targetIndex: number): void {
    const selectedBlock = this.selectedCanvasBlock();
    if (!selectedBlock) {
      return;
    }

    const workspace = moveBlockInWorkspace(
      this.currentWorkspace(),
      selectedBlock.id,
      targetIndex
    );
    this.commitWorkspace(workspace);
  }

  removeSelectedBlock(): void {
    const selectedBlock = this.selectedCanvasBlock();
    if (!selectedBlock) {
      return;
    }

    const workspace = removeBlockFromWorkspace(
      this.currentWorkspace(),
      selectedBlock.id
    );
    this.commitWorkspace(workspace);
  }

  openMobileSheet(view: 'auto' | 'structure' | 'inspector' = 'auto'): void {
    this.mobileSheetView.set(view);
    this.mobileSheetOpen.set(true);
  }

  closeMobileSheet(): void {
    this.mobileSheetOpen.set(false);
  }

  mobileSheetMode(): 'structure' | 'inspector' {
    if (this.mobileSheetView() === 'structure') {
      return 'structure';
    }

    if (this.mobileSheetView() === 'inspector' && this.selectedCanvasBlock()) {
      return 'inspector';
    }

    return this.selectedCanvasBlock() ? 'inspector' : 'structure';
  }

  mobileSheetTitle(): string {
    return this.mobileSheetMode() === 'inspector'
      ? this.selectedCanvasBlock()?.data['title']?.toString() ||
          'Selected Section'
      : 'Page Structure';
  }

  // Save/Cancel Actions
  onSave(): void {
    if (!this.config.name) {
      alert('Please provide a name for the configuration');
      return;
    }

    console.log('[AppConfigDesigner] Saving configuration:', this.config);

    if (this.configId) {
      console.log(
        '[AppConfigDesigner] Updating existing configuration:',
        this.configId
      );
      this.appConfigService
        .updateConfiguration(this.configId, this.config)
        .subscribe({
          next: (updated) => {
            console.log('[AppConfigDesigner] Configuration updated:', updated);
            alert('Configuration saved successfully!');
            this.saved.emit(updated);
            this.router.navigate(['/dashboard/app-config']);
          },
          error: (err) => {
            console.error(
              '[AppConfigDesigner] Failed to update configuration:',
              err
            );
            alert(
              `Failed to save configuration: ${
                err.message || err.statusText || 'Unknown error'
              }`
            );
          },
        });
    } else {
      console.log('[AppConfigDesigner] Creating new configuration');
      this.appConfigService.createConfiguration(this.config as any).subscribe({
        next: (created) => {
          console.log('[AppConfigDesigner] Configuration created:', created);
          alert('Configuration created successfully!');
          this.saved.emit(created);
          this.router.navigate(['/dashboard/app-config']);
        },
        error: (err) => {
          console.error(
            '[AppConfigDesigner] Failed to create configuration:',
            err
          );
          alert(
            `Failed to save configuration: ${
              err.message || err.statusText || 'Unknown error'
            }`
          );
        },
      });
    }
  }

  onCancel(): void {
    if (confirm('Are you sure you want to discard changes?')) {
      this.cancelled.emit();
      this.router.navigate(['/dashboard/app-config']);
    }
  }

  private currentWorkspace() {
    let workspace = createEditorWorkspace(
      this.workspaceDocument(),
      this.workspaceMode
    );

    if (this.selectedBlockId()) {
      workspace = selectBlockInWorkspace(workspace, this.selectedBlockId());
    }

    return workspace;
  }

  private commitWorkspace(
    workspace: ReturnType<typeof createEditorWorkspace>
  ): void {
    this.applyWorkspaceDocument(workspace.document);
    this.selectedBlockId.set(workspace.selectedBlockId);
  }

  private syncWorkspaceFromConfig(): void {
    const document = appConfigToConfigDocument(this.asAppConfiguration());
    this.workspaceDocument.set(document);
    if (
      this.selectedBlockId() &&
      !document.blocks.some((block) => block.id === this.selectedBlockId())
    ) {
      this.selectedBlockId.set(null);
      this.mobileSheetView.set('structure');
    }
  }

  private applyWorkspaceDocument(document: ConfigDocument): void {
    const next = configDocumentToAppConfig(document, this.asAppConfiguration());
    this.config = {
      name: next.name,
      description: next.description,
      domain: next.domain,
      landingPage: next.landingPage,
      routes: next.routes,
      features: next.features,
      theme: next.theme,
      active: next.active,
      createdAt: next.createdAt,
      updatedAt: next.updatedAt,
    };
    this.workspaceDocument.set(appConfigToConfigDocument(next));
    this.syncThemePreview();
  }

  asAppConfiguration(): AppConfiguration {
    return {
      id: this.configId ?? 'draft-config',
      ...this.config,
    };
  }

  private syncThemePreview(): void {
    const theme = this.config.theme;
    if (!theme) {
      return;
    }

    this.themeService.setPrimaryColor(theme.primaryColor || '#3f51b5');
    this.themeService.setTheme(theme.mode || 'light');
    void this.themeService.setPersonality(
      theme.personalityId || 'professional'
    );
  }

  private isMobileViewport(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches
    );
  }
}
