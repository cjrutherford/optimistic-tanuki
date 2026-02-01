import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  forwardRef,
  HostListener,
  inject,
  OnDestroy,
  Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';

import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Editor } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';

import {
  AccordionComponent, ButtonComponent,
  CardComponent, ContentSectionComponent, GradientBuilder, HeroSectionComponent, ModalComponent
} from '@optimistic-tanuki/common-ui';
import {
  CheckboxComponent,
  RadioButtonComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import {
  Themeable,
  ThemeColors,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';
import { ContextMenuComponent } from '../context-menu/context-menu.component';

// Component injection system imports
import {
  ComponentInjectionAPI,
  ComponentInjectionService,
  InjectableComponent,
  InjectedComponentInstance,
  UnifiedComponentRegistryService,
} from '@optimistic-tanuki/compose-lib';
import { ComponentSelectorComponent } from './components/component-selector.component';

// Example components
import { CalloutBoxComponent } from './components/example-components/callout-box.component';
import { CodeSnippetComponent } from './components/example-components/code-snippet.component';
import { ImageGalleryComponent } from './components/example-components/image-gallery.component';

// Existing blogging components
import { FeaturedPostsComponent } from '../featured-posts/featured-posts.component';
import { HeroComponent } from '../hero/hero.component';
import { NewsletterSignupComponent } from '../newsletter-signup/newsletter-signup.component';

// Property editing system
import DOMPurify from 'dompurify';
import {
  PropertyDefinition,
  PropertyEditorComponent,
} from './components/property-editor.component';
import { COMPONENT_PROPERTY_DEFINITIONS } from './configs/component-properties.config';

// Rich text toolbar
import { RichTextToolbarComponent } from './components/rich-text-toolbar.component';

// Angular Component Node Extension
import { BlogComposeComponentNode } from './extensions/blog-compose-component.extension';

import { DEFAULT_POST_THEME, PostThemeConfig } from '@optimistic-tanuki/ui-models';

interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: File[];
  injectedComponents?: InjectedComponentInstance[];
  themeConfig?: PostThemeConfig;
}

@Component({
  selector: 'lib-blog-compose',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    TextInputComponent,
    ButtonComponent,
    ContextMenuComponent,
    ComponentSelectorComponent,
    PropertyEditorComponent,
    RichTextToolbarComponent,
    TiptapEditorDirective,
  ],
  templateUrl: './blog-compose.component.html',
  styleUrls: ['./blog-compose.component.scss'],
  styles: [
    `
      .theme-config-panel {
        margin-bottom: 1rem;
        border: 1px solid var(--local-border-color);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.05);
      }
      .theme-config-header {
        padding: 0.75rem 1rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        background: rgba(0, 0, 0, 0.1);
        font-weight: 500;
      }
      .theme-config-content {
        padding: 1rem;
        display: flex;
        gap: 2rem;
        align-items: center;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .theme-toggles {
        display: flex;
        gap: 0.5rem;
      }
      input[type='color'] {
        width: 50px;
        height: 30px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
    `,
  ],
  host: {
    '[class.theme]': 'theme',
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-background-gradient]': 'backgroundGradient',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-complement]': 'complement',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
  providers: [
    ComponentInjectionService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BlogComposeComponent),
      multi: true,
    },
  ],
})
export class BlogComposeComponent
  extends Themeable
  implements
  OnDestroy,
  AfterViewInit,
  ComponentInjectionAPI,
  ControlValueAccessor {
  @Output() postSubmitted: EventEmitter<PostData> =
    new EventEmitter<PostData>();
  @Output() attachmentAdded = new EventEmitter<{
    placeholderId: string;
    file: File;
  }>();

  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  override readonly themeService: ThemeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input);
  }

  // Theming properties;
  backgroundGradient = 'linear-gradient(to right, #5969c3, #59c360)';
  isDragOver = false;

  private _title = '';
  private _content = '';

  get title(): string {
    return this._title;
  }

  set title(value: string) {
    if (this._title !== value) {
      this._title = value;
      this.emitChange();
    }
  }

  get content(): string {
    return this._content;
  }

  set content(value: string) {
    this._content = value;
    // Don't emit change here as it's handled by editor update event
  }

  links: Array<{ url: string }> = [];
  attachments: File[] = [];

  editor!: Editor;

  isContextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;

  // Component injection properties
  isComponentSelectorVisible = false;
  registeredComponents: InjectableComponent[] = [];
  activeComponents = new Map<string, InjectedComponentInstance>();

  // Theme configuration properties
  isThemeConfigVisible = false;
  postTheme: 'light' | 'dark' = 'light';
  postAccentColor = '#3f51b5';

  // Property editing properties
  isPropertyEditorVisible = false;
  selectedComponentInstance: InjectedComponentInstance | null = null;
  selectedComponentProperties: PropertyDefinition[] = [];

  // Flag to track if there's pending content to set after editor init
  private pendingContent: string | null = null;
  // Inject centralized services from compose-lib
  private componentInjectionService = inject(ComponentInjectionService);
  private unifiedRegistry = inject(UnifiedComponentRegistryService);

  constructor() {
    super();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest('lib-property-editor') ||
      target.closest('lib-component-selector') ||
      target.closest('.property-editor')
    ) {
      return;
    }

    this.isContextMenuVisible = false;
    this.selectedComponentInstance = null;

    if (this.isPropertyEditorVisible) {
      this.hidePropertyEditor();
    }
  }

  private deepClone<T>(value: T): T {
    if (value === null || value === undefined) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      console.warn('Failed to deep clone value, falling back to spread', e);
      return Array.isArray(value) ? [...value] as any : { ...value };
    }
  }

  ngAfterViewInit(): void {
    Promise.resolve().then(() => {
      this.componentInjectionService.setViewContainer(this.componentContainer);

      // Set up callbacks for component wrapper events
      this.componentInjectionService.setWrapperCallbacks({
        onEdit: (instance) => this.onComponentEdit(instance),
        onDelete: (instance) => this.onComponentDelete(instance),
        onMoveUp: (instance) => this.onComponentMoveUp(instance),
        onMoveDown: (instance) => this.onComponentMoveDown(instance),
        onSelection: (instance) => this.onComponentSelection(instance),
        onPropertiesChanged: (instance, data) => this.onComponentPropertiesChanged(instance, data),
      });

      this.initializeDefaultComponents();

      this.editor = new Editor({
        extensions: [
          StarterKit,
          Image,
          Subscript,
          Superscript,
          Underline,
          TextAlign.configure({
            types: ['heading', 'paragraph'],
          }),
          Table.configure({
            resizable: true,
          }),
          TableRow,
          TableHeader,
          TableCell,
          BlogComposeComponentNode.configure({
            onComponentClick: (componentId: string, instanceId: string) => {
              this.onInlineComponentClick(componentId, instanceId);
            },
            onComponentDelete: (instanceId: string) => {
              this.onInlineComponentDelete(instanceId);
            },
            onComponentEdit: (instanceId: string) => {
              this.onInlineComponentEdit(instanceId);
            },
            renderer: (
              componentId: string,
              instanceId: string,
              data: Record<string, unknown>,
              element: HTMLElement
            ) => {
              return this.componentInjectionService.renderComponentInto(
                componentId,
                instanceId,
                data,
                element
              );
            },
          }),
        ],
        editorProps: {
          attributes: {
            class: 'prosemirror-editor',
          },
        },
        content: this._content,
      });

      // Apply pending content if writeValue was called before editor init
      if (this.pendingContent !== null) {
        this.editor.commands.setContent(this.pendingContent);
        this.pendingContent = null;
      }

      this.editor.view.dom.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.contextMenuX = event.clientX;
        this.contextMenuY = event.clientY;
        this.isContextMenuVisible = true;
      });

      // Listen for content changes and emit for form control
      this.editor.on('update', () => {
        const newContent = this.editor.getHTML();
        if (this._content !== newContent) {
          this._content = this.sanitize(newContent);
          this.emitChange();
        }
      });

      if (this.cdr) {
        this.cdr.detectChanges();
      }
    });
  }

  override ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // Component injection system initialization
  private initializeDefaultComponents(): void {
    // ============================================
    // BLOGGING UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'callout-box',
      name: 'Callout Box',
      description: 'Highlight important information with colored callout boxes',
      component: CalloutBoxComponent,
      category: 'Blogging',
      icon: 'info',
      data: {
        type: 'info',
        title: 'Important Note',
        content: 'This is an important callout box.',
      },
    });

    this.registerComponent({
      id: 'code-snippet',
      name: 'Code Snippet',
      description: 'Display formatted code with syntax highlighting',
      component: CodeSnippetComponent,
      category: 'Blogging',
      icon: 'code',
      data: {
        title: 'Example Code',
        language: 'javascript',
        code: 'console.log("Hello, World!");',
      },
    });

    this.registerComponent({
      id: 'image-gallery',
      name: 'Image Gallery',
      description: 'Create responsive image galleries',
      component: ImageGalleryComponent,
      category: 'Blogging',
      icon: 'photo_library',
      data: {
        title: 'Sample Gallery',
        columns: 3,
      },
    });

    this.registerComponent({
      id: 'hero',
      name: 'Hero Section',
      description:
        'Eye-catching hero section with title, description, and call-to-action',
      component: HeroComponent,
      category: 'Blogging',
      icon: 'landscape',
      data: {
        title: 'Welcome to Our Blog!',
        subtitle: '',
        description:
          'Discover the latest news, tips, and stories from our community.',
        buttonText: 'Get Started',
        imageUrl: 'https://media.craiyon.com/2026-02-01/Utu4UCrMQeGuDr15FVIRnQ.webp',
      },
    });

    this.registerComponent({
      id: 'featured-posts',
      name: 'Featured Posts',
      description: 'Showcase featured blog posts in an interactive carousel',
      component: FeaturedPostsComponent,
      category: 'Blogging',
      icon: 'featured_play_list',
      data: {
        visibleItems: 3,
        featuredPosts: [
          {
            title: 'Understanding Microservices Architecture',
            bannerImage: 'https://picsum.photos/id/1011/800/400',
            excerpt:
              'A deep dive into the principles and benefits of microservices.',
            authorName: 'Jane Doe',
            publishDate: '2024-05-10',
            readMoreLink: '/blog/microservices-architecture',
          },
        ],
      },
    });

    this.registerComponent({
      id: 'newsletter-signup',
      name: 'Newsletter Signup',
      description: 'Collect email subscriptions with an attractive signup form',
      component: NewsletterSignupComponent,
      category: 'Blogging',
      icon: 'email',
      data: {
        bannerImage: 'https://media.craiyon.com/2026-02-01/Utu4UCrMQeGuDr15FVIRnQ.webp',
      },
    });

    // ============================================
    // COMMON UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'common-card',
      name: 'Card',
      description:
        'A styled card container for organizing content with optional glass effect',
      component: CardComponent,
      category: 'Common UI',
      icon: 'dashboard',
      data: {
        glassEffect: false,
        CardVariant: 'default',
      },
    });

    this.registerComponent({
      id: 'common-button',
      name: 'Button',
      description: 'Interactive button with multiple style variants',
      component: ButtonComponent,
      category: 'Common UI',
      icon: 'smart_button',
      data: {
        variant: 'primary',
        disabled: false,
        label: 'Click Me',
      },
    });

    this.registerComponent({
      id: 'common-accordion',
      name: 'Accordion',
      description: 'Collapsible sections for organizing content',
      component: AccordionComponent,
      category: 'Common UI',
      icon: 'view_agenda',
      data: {
        variant: 'default',
        size: 'md',
        sections: [
          { heading: 'Section 1', content: 'Content for section 1' },
          { heading: 'Section 2', content: 'Content for section 2' },
        ],
      },
    });

    this.registerComponent({
      id: 'common-modal',
      name: 'Modal',
      description: 'Overlay dialog for focused content or user interactions',
      component: ModalComponent,
      category: 'Common UI',
      icon: 'open_in_new',
      data: {
        heading: 'Modal Title',
        mode: 'standard-modal',
        variant: 'default',
        size: 'md',
      },
    });

    this.registerComponent({
      id: 'common-hero-section',
      name: 'Hero Section (Common)',
      description: 'Large banner section for prominent content display',
      component: HeroSectionComponent,
      category: 'Common UI',
      icon: 'view_carousel',
      data: {
        title: 'Welcome',
        subtitle: 'Discover amazing content',
        backgroundImage: '',
        alignment: 'center',
      },
    });

    this.registerComponent({
      id: 'common-content-section',
      name: 'Content Section',
      description: 'Flexible content container with layout options',
      component: ContentSectionComponent,
      category: 'Common UI',
      icon: 'article',
      data: {
        title: 'Content Section',
        layout: 'single-column',
      },
    });

    // ============================================
    // FORM UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'form-text-input',
      name: 'Text Input',
      description:
        'Single-line text input field with label and placeholder support',
      component: TextInputComponent,
      category: 'Form UI',
      icon: 'text_fields',
      data: {
        type: 'text',
        label: 'Text Input',
        placeholder: 'Enter text...',
        labelPosition: 'top',
      },
    });

    this.registerComponent({
      id: 'form-checkbox',
      name: 'Checkbox',
      description: 'Checkbox input for boolean selections',
      component: CheckboxComponent,
      category: 'Form UI',
      icon: 'check_box',
      data: {
        value: false,
      },
    });

    this.registerComponent({
      id: 'form-select',
      name: 'Select Dropdown',
      description: 'Dropdown selection with customizable options',
      component: SelectComponent,
      category: 'Form UI',
      icon: 'arrow_drop_down_circle',
      data: {
        options: [
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
          { value: 'option3', label: 'Option 3' },
        ],
      },
    });

    this.registerComponent({
      id: 'form-radio-button',
      name: 'Radio Button',
      description: 'Radio button for single selection within a group',
      component: RadioButtonComponent,
      category: 'Form UI',
      icon: 'radio_button_checked',
      data: {
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
        ],
        layout: 'vertical',
        selected: '',
      },
    });

    this.registerComponent({
      id: 'form-text-area',
      name: 'Text Area',
      description: 'Multi-line text input for longer content',
      component: TextAreaComponent,
      category: 'Form UI',
      icon: 'notes',
      data: {
        label: 'Text Area',
      },
    });

    this.registeredComponents = this.getRegisteredComponents();
  }

  // Component injection API implementation (now working with inline editor)
  registerComponent(component: InjectableComponent): void {
    // Register with unified registry using source identifier
    this.unifiedRegistry.registerComponent(component, 'blogging-ui');
    this.registeredComponents = this.getRegisteredComponents();
  }

  unregisterComponent(componentId: string): void {
    this.unifiedRegistry.unregisterComponent(componentId, 'blogging-ui');
    this.registeredComponents = this.getRegisteredComponents();
  }

  getRegisteredComponents(): InjectableComponent[] {
    return this.unifiedRegistry.getAllComponents();
  }

  getComponentsByCategory(category: string): InjectableComponent[] {
    return this.unifiedRegistry.getComponentsByCategory(category);
  }

  async injectComponent(
    componentId: string,
    data?: Record<string, unknown>
  ): Promise<InjectedComponentInstance> {
    console.log('[blog compose] injectComponent called for:', componentId);

    // Use our new inline injection method instead
    const component = this.unifiedRegistry
      .getAllComponents()
      .find((comp) => comp.id === componentId);

    if (!component) {
      console.error('[blog compose] Component not found:', componentId);
      throw new Error(`Component ${componentId} not found`);
    }

    console.log('[blog compose] Found component definition:', component);

    const instanceId = `${componentId}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    console.log('[blog compose] Generated instance ID:', instanceId);

    const componentData = this.deepClone(data || component.data || {});

    // Insert into TipTap editor
    this.editor.commands.insertAngularComponent({
      componentId,
      instanceId,
      data: componentData,
      componentDef: component,
    });

    console.log('[blog compose] Inserted component into TipTap editor');

    // Retrieve the instance from the service
    // Since Tiptap updates are synchronous for DOM, the renderer should have been called.
    const instance = this.componentInjectionService.getInstance(instanceId);

    if (!instance) {
      console.error('[blog compose] Failed to retrieve instance:', instanceId);
      // Fallback if something went wrong, though it shouldn't if renderer works.
      // We return a mock or throw.
      throw new Error('Failed to inject component instance');
    }

    console.log('[blog compose] Retrieved instance from service:', instance);

    this.activeComponents.set(instanceId, instance);
    console.log('[blog compose] Added to activeComponents. Total active components:', this.activeComponents.size);
    console.log('[blog compose] ActiveComponents keys:', Array.from(this.activeComponents.keys()));

    return instance;
  }

  // Override component injection methods to work with inline editor
  updateComponent(instanceId: string, data: Record<string, unknown>): void {
    this.editor.commands.updateAngularComponent({
      instanceId,
      data,
    });

    // Also update local cache if present
    const instance = this.activeComponents.get(instanceId);
    if (instance) {
      instance.data = { ...instance.data, ...data };
    }
  }

  getActiveComponents(): InjectedComponentInstance[] {
    return Array.from(this.activeComponents.values());
  }

  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.activeComponents.get(instanceId);
  }

  removeComponent(instanceId: string): void {
    this.activeComponents.delete(instanceId);
  }

  moveComponent(instanceId: string, newPosition: number): void {
    // TipTap handles the positioning within the editor
    // This method is kept for interface compatibility
    console.log(`Moving component ${instanceId} to position ${newPosition}`);
  }

  toggleThemeConfig(): void {
    this.isThemeConfigVisible = !this.isThemeConfigVisible;
  }

  updatePostTheme(theme: 'light' | 'dark'): void {
    this.postTheme = theme;
    // Don't update global theme - this is post-specific
  }

  updatePostAccentColor(color: string): void {
    this.postAccentColor = color;
    // Don't update global theme - this is post-specific
  }

  // UI event handlers
  showComponentSelector(): void {
    this.isComponentSelectorVisible = true;
  }

  hideComponentSelector(): void {
    this.isComponentSelectorVisible = false;
  }

  // Property editing methods
  onComponentEdit(instance: InjectedComponentInstance): void {
    console.log('[blog compose] onComponentEdit called');
    console.log('[blog compose] Instance:', instance);
    console.log('[blog compose] Component ID:', instance.componentDef.id);
    console.log('[blog compose] Component name:', instance.componentDef.name);
    console.log('[blog compose] Instance ID:', instance.instanceId);
    console.log('[blog compose] Component data:', instance.data);

    this.selectedComponentInstance = instance;
    console.log('[blog compose] Set selectedComponentInstance to:', this.selectedComponentInstance);

    // Check if property definitions exist
    const propertyDefs = COMPONENT_PROPERTY_DEFINITIONS[instance.componentDef.id];
    console.log('[blog compose] Property definitions for', instance.componentDef.id, ':', propertyDefs);

    this.selectedComponentProperties = propertyDefs || [];
    console.log('[blog compose] Set selectedComponentProperties to:', this.selectedComponentProperties);

    this.isPropertyEditorVisible = true;
    console.log('[blog compose] Set property editor visible');
  }

  onComponentDelete(instance: InjectedComponentInstance): void {
    // Remove from TipTap editor first
    this.editor.commands.removeAngularComponent(instance.instanceId);
    // Then remove from our tracking system
    this.removeComponent(instance.instanceId);
    if (this.selectedComponentInstance?.instanceId === instance.instanceId) {
      this.selectedComponentInstance = null;
    }
  }

  onComponentMoveUp(instance: InjectedComponentInstance): void {
    const activeComponents = this.getActiveComponents();
    const currentIndex = activeComponents.findIndex(
      (c) => c.instanceId === instance.instanceId
    );
    if (currentIndex > 0) {
      this.moveComponent(instance.instanceId, currentIndex - 1);
    }
  }

  onComponentMoveDown(instance: InjectedComponentInstance): void {
    const activeComponents = this.getActiveComponents();
    const currentIndex = activeComponents.findIndex(
      (c) => c.instanceId === instance.instanceId
    );
    if (currentIndex < activeComponents.length - 1) {
      this.moveComponent(instance.instanceId, currentIndex + 1);
    }
  }

  onComponentSelection(instance: InjectedComponentInstance): void {
    this.selectedComponentInstance = instance;
  }

  onComponentPropertiesChanged(instance: InjectedComponentInstance, data: Record<string, any>): void {
    // Temporarily set selected instance to use existing update logic
    const prevSelected = this.selectedComponentInstance;
    this.selectedComponentInstance = instance;

    // Get property definitions to handle outputs properly
    this.selectedComponentProperties = COMPONENT_PROPERTY_DEFINITIONS[instance.componentDef.id] || [];

    this.onPropertiesUpdated(data);

    // Restore previous selection if it wasn't the one we just edited
    if (prevSelected?.instanceId !== instance.instanceId) {
      this.selectedComponentInstance = prevSelected;
      // Restore properties for the selected one if needed
      if (prevSelected) {
        this.selectedComponentProperties = COMPONENT_PROPERTY_DEFINITIONS[prevSelected.componentDef.id] || [];
      } else {
        this.selectedComponentProperties = [];
      }
    }
  }

  onPropertiesUpdated(updatedData: any): void {
    console.log('[blog compose] onPropertiesUpdated called with data:', updatedData);
    console.log('[blog compose] Selected component instance:', this.selectedComponentInstance);
    console.log('[blog compose] Selected component properties:', this.selectedComponentProperties);

    if (this.selectedComponentInstance) {
      console.log('[blog compose] Component ID:', this.selectedComponentInstance.componentDef.id);
      console.log('[blog compose] Component name:', this.selectedComponentInstance.componentDef.name);
      console.log('[blog compose] Instance ID:', this.selectedComponentInstance.instanceId);
      console.log('[blog compose] Component data:', this.selectedComponentInstance.data);

      // Handle output configuration
      const outputConfigs: any = {};
      this.selectedComponentProperties.forEach((prop) => {
        if (prop.isOutput) {
          const url = updatedData[prop.key + '_url'];
          if (url) {
            outputConfigs[prop.key] = {
              url,
              schema: prop.outputSchema,
            };
          }
          // Remove temporary keys
          delete updatedData[prop.key + '_url'];
          delete updatedData[prop.key + '_schema'];
        }
      });

      // Store output configurations separately
      const finalData = { ...updatedData };
      if (Object.keys(outputConfigs).length > 0) {
        finalData._outputConfigs = outputConfigs;
      }

      // Update the inner component properties
      interface InnerComponentRef {
        instance: Record<string, unknown>;
        changeDetectorRef: { detectChanges: () => void };
      }
      const innerComponentRef = this.selectedComponentInstance?.data?.['_innerComponentRef'] as InnerComponentRef | undefined;
      if (innerComponentRef && typeof innerComponentRef === 'object') {
        Object.keys(finalData).forEach((key) => {
          if (
            key !== '_innerComponentRef' &&
            key !== '_outputConfigs' &&
            innerComponentRef.instance?.[key] !== undefined
          ) {
            innerComponentRef.instance[key] = finalData[key];
          }
        });
        innerComponentRef.changeDetectorRef?.detectChanges();
      }

      this.updateComponent(
        this.selectedComponentInstance.instanceId,
        finalData
      );

      // Update the TipTap editor node as well
      this.editor.commands.updateAngularComponent({
        instanceId: this.selectedComponentInstance.instanceId,
        data: finalData,
      });

      this.hidePropertyEditor();
    }
  }

  hidePropertyEditor(): void {
    this.isPropertyEditorVisible = false;
    this.selectedComponentInstance = null;
    this.selectedComponentProperties = [];
  }

  isComponentSelected(instance: InjectedComponentInstance): boolean {
    return this.selectedComponentInstance?.instanceId === instance.instanceId;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      const base64Src = reader.result as string;
      if (base64Src) {
        this.editor.chain().focus().setImage({ src: base64Src }).run();
      }
    };

    reader.readAsDataURL(file);
  }

  onToolbarComponentsClick(): void {
    this.showComponentSelector();
  }

  onToolbarImageUploadClick(): void {
    // Trigger the hidden file input
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Inline component interaction methods
  onInlineComponentClick(componentId: string, instanceId: string): void {
    // Find the component instance and trigger edit mode
    const instance = this.getActiveComponents().find(
      (comp) => comp.instanceId === instanceId
    );
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  onInlineComponentDelete(instanceId: string): void {
    // Remove from editor and component system
    this.editor.commands.removeAngularComponent(instanceId);
    this.removeComponent(instanceId);
  }

  onInlineComponentEdit(instanceId: string): void {
    // Find the component instance and open property editor
    const instance = this.getActiveComponents().find(
      (comp) => comp.instanceId === instanceId
    );
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  // Modified component injection to work with inline editor
  async onComponentSelected(component: InjectableComponent): Promise<void> {
    try {
      const instanceId = `${component.id}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      console.log('[blog compose] Injecting component:', component.id, 'with instanceId:', instanceId);

      const componentData = this.deepClone(component.data || {});

      // Insert into TipTap editor instead of separate container
      // this.editor.commands.insertAngularComponent({
      //   componentId: component.id,
      //   instanceId: instanceId,
      //   data: componentData,
      //   componentDef: component,
      // });

      this.editor
        .chain()
        .focus()
        .insertAngularComponent({
          componentId: component.id,
          instanceId: instanceId,
          data: componentData,
          componentDef: component,
        })
        .insertContent('<p></p>')
        .run();

      console.log('[blog compose] Inserted component into TipTap editor');

      const realInstance = this.componentInjectionService.getInstance(instanceId);

      if (realInstance) {
        console.log('[blog compose] Retrieved real instance from service:', realInstance);
        this.activeComponents.set(instanceId, realInstance);
        this.hideComponentSelector();
        return;
      }

      // Still track the component in our system for editing
      const mockComponentRef = {
        instance: component.data || {},
        changeDetectorRef: {
          detectChanges: () => {
            // Mock implementation
          },
        },
        destroy: () => {
          // Mock implementation
        },
      } as any;

      const injectedInstance: InjectedComponentInstance = {
        instanceId,
        componentDef: component,
        componentRef: mockComponentRef,
        data: componentData,
      };

      this.activeComponents.set(instanceId, injectedInstance);
      this.hideComponentSelector();
    } catch (error) {
      console.error('Error injecting component:', error);
    }
  }

  handleDragEnter(e: Event): void {
    e.preventDefault();
    this.isDragOver = true;
  }

  handleDragOver(e: Event): void {
    e.preventDefault();
    this.isDragOver = true;
  }

  handleDragLeave(e: Event): void {
    e.preventDefault();
    this.isDragOver = false;
  }

  handleDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;

    if (!e.dataTransfer?.files.length) return;

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      const placeholderId = `upload-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;
      this.attachmentAdded.emit({ placeholderId, file });

      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const base64Src = event.target?.result as string;
        if (base64Src) {
          this.editor.chain().focus().setImage({ src: base64Src }).run();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  onPostSubmit() {
    this.postSubmitted.emit({
      title: this.title,
      content: this.content,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(),
      themeConfig: {
        theme: this.postTheme,
        accentColor: this.postAccentColor,
      },
    });
  }

  // ControlValueAccessor implementation
  private onChange = (value: any) => {
    // Default implementation
  };
  private onTouched = () => {
    // Default implementation
  };

  writeValue(value: any): void {
    if (value && typeof value === 'object') {
      this._title = value.title || '';
      this._content = value.content || '';
      this.links = value.links || [];
      this.attachments = value.attachments || [];

      // Load post theme configuration
      if (value.themeConfig) {
        this.postTheme = value.themeConfig.theme || DEFAULT_POST_THEME.theme;
        this.postAccentColor = value.themeConfig.accentColor || DEFAULT_POST_THEME.accentColor;
      } else {
        this.postTheme = DEFAULT_POST_THEME.theme;
        this.postAccentColor = DEFAULT_POST_THEME.accentColor;
      }

      // Update editor content if editor is available, otherwise queue it
      if (this.editor) {
        this.editor.commands.setContent(this._content);
        this.pendingContent = null;
      } else {
        // Queue content to be set after editor initialization
        this.pendingContent = this._content;
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Handle disabled state if needed
    if (this.editor) {
      this.editor.setEditable(!isDisabled);
    }
  }

  private emitChange(): void {
    const value = {
      title: this.title,
      content: this.content,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(),
    };
    this.onChange(value);
    this.onTouched();
  }

  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments
    this.background = colors.background;
    this.backgroundGradient = new GradientBuilder()
      .setType('radial')
      .setOptions({
        shape: 'ellipse',
        position: 'center',
        colors: [colors.accent, colors.complementary],
      })
      .build();
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;

    // Use standardized gradient names and numbered shades
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
    this.transitionDuration = '0.15s'; // Use standardized duration
  }
}
