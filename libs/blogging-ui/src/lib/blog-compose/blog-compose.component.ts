import {
  Component,
  EventEmitter,
  Output,
  Input,
  OnDestroy,
  HostListener,
  ViewChild,
  ViewContainerRef,
  AfterViewInit,
  inject,
  forwardRef,
  ChangeDetectorRef,
} from '@angular/core';

import {
  FormsModule,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

import {
  Themeable,
  ThemeColors,
  ThemeService,
} from '@optimistic-tanuki/theme-lib';
import { GradientBuilder } from '@optimistic-tanuki/common-ui';
import {
  ButtonComponent,
  CardComponent,
  AccordionComponent,
  ModalComponent,
  HeroSectionComponent,
  ContentSectionComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextAreaComponent,
  TextInputComponent,
  CheckboxComponent,
  SelectComponent,
  RadioButtonComponent,
} from '@optimistic-tanuki/form-ui';
import { ContextMenuComponent } from '../context-menu/context-menu.component';

// Component injection system imports
import { ComponentInjectionService } from './services/component-injection.service';
import { ComponentSelectorComponent } from './components/component-selector.component';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionAPI,
  PropertyDefinition,
} from './interfaces/component-injection.interface';

// Example components
import { CalloutBoxComponent } from './components/example-components/callout-box.component';
import { CodeSnippetComponent } from './components/example-components/code-snippet.component';
import { ImageGalleryComponent } from './components/example-components/image-gallery.component';

// Existing blogging components
import { HeroComponent } from '../hero/hero.component';
import { FeaturedPostsComponent } from '../featured-posts/featured-posts.component';
import { NewsletterSignupComponent } from '../newsletter-signup/newsletter-signup.component';

// Property editing system
import { PropertyEditorComponent } from './components/property-editor.component';
import DOMPurify from 'dompurify';

// Rich text toolbar
import { RichTextToolbarComponent } from './components/rich-text-toolbar.component';

// Angular Component Node Extension
import { BlogComposeComponentNode } from './extensions/blog-compose-component.extension';

// Resizable Image Extension
import { ResizableImage } from './extensions/resizable-image.extension';

// Image Upload Service
import { ImageUploadService, ComponentInjection, InjectedComponentData } from '@optimistic-tanuki/compose-lib';

import { PostThemeConfig, DEFAULT_POST_THEME } from '@optimistic-tanuki/ui-models';

interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: File[];
  injectedComponents?: InjectedComponentInstance[]; // Old format for backward compatibility
  injectedComponentsNew?: InjectedComponentData[]; // New format for database persistence
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
  @Input() profileId?: string; // Profile ID for asset uploads
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
  private imageUploadService = inject(ImageUploadService);

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input);
  }

  // Theming properties;
  backgroundGradient = 'linear-gradient(to right, #5969c3, #59c360)';
  isDragOver = false;

  private _title = '';
  private _content = '';

  // ControlValueAccessor callbacks
  onChange: (value: any) => void = () => { };
  onTouched: () => void = () => { };
  isDisabled = false;

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
    this.emitChange();
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
  // Removed local activeComponents map in favor of service

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
  private pendingInjectedComponents: any[] | null = null;
  private componentInjectionService = inject(ComponentInjectionService);
  
  // Track components from new extension
  private currentComponents: InjectedComponentData[] = [];

  constructor() {
    super();
  }



  @HostListener('document:click')
  onDocumentClick(): void {
    this.isContextMenuVisible = false;
    this.selectedComponentInstance = null;
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
        onDuplicate: (instance) => this.onComponentDuplicate(instance),
        onConfig: (instance) => this.onComponentConfig(instance),
        onPropertiesChanged: (data) => this.onComponentPropertiesChanged(data),
      });

      this.initializeDefaultComponents();

      this.editor = new Editor({
        extensions: [
          StarterKit,
          ResizableImage,
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
          // New simplified ComponentInjection extension
          ComponentInjection.configure({
            onComponentsChanged: (components) => {
              this.handleComponentsChanged(components);
            },
            onComponentClick: (instanceId) => {
              this.handleComponentClick(instanceId);
            },
            onComponentEdit: (instanceId, data) => {
              this.handleComponentEdit(instanceId, data);
            }
          }),
          // Keep old extension temporarily for compatibility
          BlogComposeComponentNode.configure({
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
            disableDefaultControls: true,
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

        if (this.pendingInjectedComponents) {
          this.restoreInjectedComponentData(this.pendingInjectedComponents);
          this.pendingInjectedComponents = null;
        }
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

  // ComponentInjection extension event handlers
  private handleComponentsChanged(components: InjectedComponentData[]): void {
    this.currentComponents = components;
    console.log('[BlogCompose] Components changed:', components);
  }

  private handleComponentClick(instanceId: string): void {
    console.log('[BlogCompose] Component clicked:', instanceId);
    // Find the component data
    const component = this.currentComponents.find(c => c.instanceId === instanceId);
    if (component) {
      // Could trigger selection or editing UI here
    }
  }

  private handleComponentEdit(instanceId: string, data: Record<string, any>): void {
    console.log('[BlogCompose] Component edit requested:', instanceId, data);
    // Could open property editor here
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
        title: 'Important Note',
        content: 'This is an important callout box.',
      },
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'type',
          type: 'string',
          label: 'Callout Type',
          description: 'Type of callout box (info, warning, success, error)',
          defaultValue: 'info',
        },
        {
          key: 'title',
          type: 'string',
          label: 'Title',
          description: 'Optional title for the callout box',
          defaultValue: '',
        },
        {
          key: 'content',
          type: 'string',
          label: 'Content',
          description: 'Main content of the callout box',
          defaultValue: 'This is a callout box component.',
        },
      ],
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
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'title',
          type: 'string',
          label: 'Title',
          description: 'Optional title for the code snippet',
          defaultValue: '',
        },
        {
          key: 'language',
          type: 'string',
          label: 'Programming Language',
          description: 'Language for syntax highlighting',
          defaultValue: 'javascript',
        },
        {
          key: 'code',
          type: 'string',
          label: 'Code Content',
          description: 'The actual code to display',
          defaultValue: 'console.log("Hello, World!");',
        },
      ],
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
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'title',
          type: 'string',
          label: 'Gallery Title',
          description: 'Optional title for the image gallery',
          defaultValue: '',
        },
        {
          key: 'columns',
          type: 'number',
          label: 'Number of Columns',
          description: 'How many columns to display (1-4)',
          defaultValue: 3,
        },
        {
          key: 'images',
          type: 'array',
          label: 'Images',
          description:
            'Array of image objects with url, alt, and caption properties',
          defaultValue: [
            {
              url: 'https://picsum.photos/300/200?random=1',
              alt: 'Sample image 1',
              caption: 'Sample caption 1',
            },
            {
              url: 'https://picsum.photos/300/200?random=2',
              alt: 'Sample image 2',
              caption: 'Sample caption 2',
            },
            {
              url: 'https://picsum.photos/300/200?random=3',
              alt: 'Sample image 3',
              caption: 'Sample caption 3',
            },
          ],
        },
      ],
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
        imageUrl: 'https://via.placeholder.com/600x400',
      },
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'title',
          type: 'string',
          label: 'Hero Title',
          description: 'Main title text for the hero section',
          defaultValue: 'Welcome to Our Blog!',
        },
        {
          key: 'subtitle',
          type: 'string',
          label: 'Subtitle',
          description: 'Optional subtitle text',
          defaultValue: '',
        },
        {
          key: 'description',
          type: 'string',
          label: 'Description',
          description: 'Descriptive text below the title',
          defaultValue:
            'Discover the latest news, tips, and stories from our community.',
        },
        {
          key: 'buttonText',
          type: 'string',
          label: 'Button Text',
          description: 'Text for the call-to-action button',
          defaultValue: 'Get Started',
        },
        {
          key: 'imageUrl',
          type: 'url',
          label: 'Background Image URL',
          description: 'URL for the hero background image',
          defaultValue: 'https://via.placeholder.com/600x400',
        },
      ],
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
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'visibleItems',
          type: 'number',
          label: 'Visible Posts',
          description: 'Number of posts to show at once',
          defaultValue: 3,
        },
        {
          key: 'featuredPosts',
          type: 'array',
          label: 'Featured Posts',
          description:
            'Array of post objects with title, bannerImage, excerpt, authorName, publishDate, and readMoreLink',
          defaultValue: [
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
      ],
    });

    this.registerComponent({
      id: 'newsletter-signup',
      name: 'Newsletter Signup',
      description: 'Collect email subscriptions with an attractive signup form',
      component: NewsletterSignupComponent,
      category: 'Blogging',
      icon: 'email',
      data: {
        bannerImage: 'https://picsum.photos/1200/300',
      },
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'bannerImage',
          type: 'string',
          label: 'Banner Image URL',
          description: 'URL for the newsletter signup banner image',
          defaultValue: 'https://via.placeholder.com/600x200',
        },
        {
          key: 'heading',
          type: 'string',
          label: 'Heading',
          description: 'Main heading text for the signup section',
          defaultValue: 'Subscribe to Our Newsletter',
        },
        {
          key: 'subheading',
          type: 'string',
          label: 'Subheading',
          description: 'Optional subheading text',
          defaultValue: 'Get the latest updates delivered to your inbox.',
        },
        {
          key: 'submitEvent',
          type: 'string',
          label: 'Submit Event',
          description: 'Event emitted when the signup form is submitted',
          isOutput: true,
          outputSchema: { email: 'string' },
        },
      ],
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
        CardVariant: 'default',
      },
      properties: [
        {
          key: 'theme',
          type: 'select',
          label: 'Theme',
          description: 'Theme mode for this component',
          options: [
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
            { label: 'Auto', value: 'auto' },
          ],
          defaultValue: 'auto',
        },
        {
          key: 'glassEffect',
          type: 'boolean',
          label: 'Glass Effect',
          description: 'Enable glassmorphism visual effect',
          defaultValue: false,
        },
        {
          key: 'CardVariant',
          type: 'string',
          label: 'Card Variant',
          description:
            'Visual style variant (default, glass, gradient, neon, etc.)',
          defaultValue: 'default',
        },
      ],
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
  // ComponentInjectionAPI implementation
  registerComponent(component: InjectableComponent): void {
    this.componentInjectionService.registerComponent(component);
    this.registeredComponents = this.getRegisteredComponents();
  }

  unregisterComponent(componentId: string): void {
    this.componentInjectionService.unregisterComponent(componentId);
    this.registeredComponents = this.getRegisteredComponents();
  }

  getRegisteredComponents(): InjectableComponent[] {
    return this.componentInjectionService.getRegisteredComponents();
  }

  getComponentsByCategory(category: string): InjectableComponent[] {
    return this.componentInjectionService.getComponentsByCategory(category);
  }

  // Component Wrapper Event Handlers
  onComponentEdit(instance: InjectedComponentInstance): void {
    console.log('[BlogCompose] Component edit requested', {
      instanceId: instance.instanceId,
      componentDefId: instance.componentDef.id,
      currentData: instance.data
    });
    this.selectedComponentInstance = instance;
    this.selectedComponentProperties = instance.componentDef.properties || [];
    this.isPropertyEditorVisible = true;
    console.log('[BlogCompose] Property editor opened', {
      propertyCount: this.selectedComponentProperties.length
    });
  }

  onComponentDelete(instance: InjectedComponentInstance): void {
    console.log('[BlogCompose] Component delete requested', {
      instanceId: instance.instanceId,
      componentDefId: instance.componentDef.id
    });

    this.componentInjectionService.removeComponent(instance.instanceId);
    // Also remove from editor
    this.editor.commands.removeAngularComponent(instance.instanceId);

    if (this.selectedComponentInstance?.instanceId === instance.instanceId) {
      this.closePropertyEditor();
    }

    console.log('[BlogCompose] Component deleted successfully', {
      instanceId: instance.instanceId
    });
  }

  onComponentMoveUp(instance: InjectedComponentInstance): void {
    const activeComponents = this.componentInjectionService.getActiveComponents();
    const currentIndex = activeComponents.findIndex(c => c.instanceId === instance.instanceId);

    console.log('[BlogCompose] Component move up requested', {
      instanceId: instance.instanceId,
      currentIndex,
      canMoveUp: currentIndex > 0
    });

    if (currentIndex > 0) {
      this.componentInjectionService.moveComponent(instance.instanceId, currentIndex - 1);
      console.log('[BlogCompose] Component moved up', {
        instanceId: instance.instanceId,
        newIndex: currentIndex - 1
      });
    }
  }

  onComponentMoveDown(instance: InjectedComponentInstance): void {
    const activeComponents = this.componentInjectionService.getActiveComponents();
    const currentIndex = activeComponents.findIndex(c => c.instanceId === instance.instanceId);

    console.log('[BlogCompose] Component move down requested', {
      instanceId: instance.instanceId,
      currentIndex,
      canMoveDown: currentIndex >= 0 && currentIndex < activeComponents.length - 1
    });

    if (currentIndex >= 0 && currentIndex < activeComponents.length - 1) {
      this.componentInjectionService.moveComponent(instance.instanceId, currentIndex + 1);
      console.log('[BlogCompose] Component moved down', {
        instanceId: instance.instanceId,
        newIndex: currentIndex + 1
      });
    }
  }

  onComponentSelection(instance: InjectedComponentInstance): void {
    console.log('[BlogCompose] Component selected', {
      instanceId: instance.instanceId,
      componentDefId: instance.componentDef.id
    });
    this.selectedComponentInstance = instance;
  }

  onComponentDuplicate(instance: InjectedComponentInstance): void {
    console.log('[BlogCompose] Component duplicate requested', {
      instanceId: instance.instanceId,
      componentDefId: instance.componentDef.id,
      data: instance.data
    });

    // Create a duplicate of the component with the same data
    const duplicateData = { ...instance.data };
    delete duplicateData._innerComponentRef; // Remove internal reference
    this.componentInjectionService.injectComponent(
      instance.componentDef.id,
      duplicateData
    );

    console.log('[BlogCompose] Component duplicated successfully', {
      originalInstanceId: instance.instanceId
    });
  }

  onComponentConfig(instance: InjectedComponentInstance): void {
    console.log('[BlogCompose] Component config requested', {
      instanceId: instance.instanceId,
      componentDefId: instance.componentDef.id
    });
    // Open property editor for configuration (same as edit)
    this.onComponentEdit(instance);
  }

  onComponentPropertiesChanged(data: { instance: InjectedComponentInstance; data: Record<string, any> }): void {
    console.log('[BlogCompose] Component properties changed (from inline edit)', {
      instanceId: data.instance.instanceId,
      componentDefId: data.instance.componentDef.id,
      oldData: data.instance.data,
      newData: data.data
    });

    // Update component properties from inline quick edit
    this.componentInjectionService.updateComponent(
      data.instance.instanceId,
      data.data
    );

    // Update the TipTap editor node as well to ensure data persistence
    this.editor.commands.updateAngularComponent({
      instanceId: data.instance.instanceId,
      data: data.data,
    });

    this.emitChange();

    console.log('[BlogCompose] Component properties updated successfully', {
      instanceId: data.instance.instanceId
    });
  }

  // Property Editor Handlers
  onPropertiesUpdated(updatedData: any): void {
    if (this.selectedComponentInstance) {
      this.componentInjectionService.updateComponent(
        this.selectedComponentInstance.instanceId,
        updatedData
      );

      // Update the TipTap editor node as well to ensure data persistence
      this.editor.commands.updateAngularComponent({
        instanceId: this.selectedComponentInstance.instanceId,
        data: updatedData,
      });

      this.emitChange();
    }
  }

  closePropertyEditor(): void {
    this.isPropertyEditorVisible = false;
    this.selectedComponentInstance = null;
    this.selectedComponentProperties = [];
  }

  // Additional API methods required by interface
  injectComponent(componentId: string, data?: any): Promise<InjectedComponentInstance> {
    // This method delegates to the new implementation that interacts with the service
    return this.onComponentSelected({ id: componentId, data } as any);
  }

  updateComponent(instanceId: string, data: any): void {
    this.componentInjectionService.updateComponent(instanceId, data);
    this.editor.commands.updateAngularComponent({ instanceId, data });
  }

  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.componentInjectionService.getInstance(instanceId);
  }

  getActiveComponents(): InjectedComponentInstance[] {
    return this.componentInjectionService.getActiveComponents();
  }

  // NEW: Get components from ComponentInjection extension
  getInjectedComponentsNew(): InjectedComponentData[] {
    // Extract components from the editor document using new format
    const components: InjectedComponentData[] = [];
    
    if (!this.editor) {
      return components;
    }

    this.editor.state.doc.descendants((node) => {
      // Check for both old and new component node types
      if (node.type.name === 'blogComposeComponent' || node.type.name === 'angularComponent') {
        components.push({
          instanceId: node.attrs.instanceId,
          componentType: node.attrs.componentId,
          componentData: node.attrs.data || {},
          position: components.length
        });
      }
    });
    
    console.log('[BlogCompose] Extracted components (new format):', components);
    return components;
  }

  removeComponent(instanceId: string): void {
    this.componentInjectionService.removeComponent(instanceId);
    // Also remove from new extension
    this.editor?.commands.removeComponent(instanceId);
  }

  moveComponent(instanceId: string, newPosition: number): void {
    this.componentInjectionService.moveComponent(instanceId, newPosition);
  }

  // UI Event Handlers
  onToolbarComponentsClick(): void {
    this.isComponentSelectorVisible = !this.isComponentSelectorVisible;
  }

  onToolbarImageUploadClick(): void {
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    // Check if profileId is available
    if (!this.profileId) {
      console.error('Profile ID is required for image upload');
      alert('Unable to upload image: User profile not found');
      input.value = '';
      return;
    }

    try {
      // Upload file to Assets service
      const assetUrl = await this.imageUploadService.uploadFile(
        file,
        this.profileId,
        `blog-image-${Date.now()}`
      );

      // Get the editor's content area width for default sizing
      const editorElement = this.editor.view.dom;
      const editorWidth = editorElement.clientWidth;

      // Set image width to 95% of editor width (leaving some margin)
      const defaultWidth = Math.floor(editorWidth * 0.95);

      // Load the image to get its natural dimensions
      const img = new Image();
      img.onload = () => {
        this.editor.chain().focus().setImage({
          src: assetUrl, // Use asset URL instead of base64
          width: defaultWidth, // numeric value, not string
        }).run();
      };
      img.src = assetUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      input.value = '';
    }
  }

  toggleThemeConfig(): void {
    this.isThemeConfigVisible = !this.isThemeConfigVisible;
  }

  updatePostTheme(theme: 'light' | 'dark'): void {
    this.postTheme = theme;
  }

  updatePostAccentColor(color: string): void {
    this.postAccentColor = color;
  }

  showComponentSelector(): void {
    this.isComponentSelectorVisible = true;
  }

  hideComponentSelector(): void {
    this.isComponentSelectorVisible = false;
  }

  // Injection Logic
  async onComponentSelected(component: InjectableComponent): Promise<InjectedComponentInstance> {
    const realComponent = this.getRegisteredComponents().find(c => c.id === component.id) || component;

    const instanceId = `${realComponent.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const instanceData = { ...(component.data || {}), ...(realComponent.data || {}) };

    // Use NEW ComponentInjection extension
    this.editor.commands.insertComponent({
      instanceId,
      componentType: realComponent.id,
      data: instanceData,
    });

    // Also use OLD system for backward compatibility (temporary)
    this.editor.commands.insertAngularComponent({
      componentId: realComponent.id,
      instanceId,
      data: instanceData,
      componentDef: realComponent,
    });

    // Move cursor to a new paragraph after the inserted component
    // This allows users to immediately continue typing or insert another component
    if (this.editor?.state?.selection) {
      this.editor.chain()
        .insertContentAt(this.editor.state.selection.to, { type: 'paragraph' })
        .focus()
        .run();
    }

    // Close component selector
    this.isComponentSelectorVisible = false;

    // Return a temporary promise/placeholder
    return new Promise(resolve => {
      setTimeout(() => {
        const instance = this.componentInjectionService.getInstance(instanceId);
        if (instance) resolve(instance);
        else resolve({
          instanceId,
          componentDef: realComponent,
          componentRef: {} as any,
          data: instanceData
        });
      }, 50);
    });
  }

  handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    // Only show drag overlay if files are being dragged (not internal components)
    const hasFiles = e.dataTransfer?.types?.includes('Files');
    if (!hasFiles) return;
    this.isDragOver = true;
  }

  handleDragOver(e: DragEvent): void {
    e.preventDefault();
    // Only show drag overlay if files are being dragged (not internal components)
    const hasFiles = e.dataTransfer?.types?.includes('Files');
    if (!hasFiles) return;
    this.isDragOver = true;
  }

  handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
  }

  async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.isDragOver = false;

    if (!e.dataTransfer?.files.length) return;

    // Check if profileId is available
    if (!this.profileId) {
      console.error('Profile ID is required for image upload');
      alert('Unable to upload image: User profile not found');
      return;
    }

    const files = Array.from(e.dataTransfer.files);

    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only');
      return;
    }

    // Upload each image file to Assets service
    for (const file of imageFiles) {
      try {
        // Upload to Assets service with a generated base filename (no extension)
        const assetUrl = await this.imageUploadService.uploadFile(
          file,
          this.profileId,
          `blog-drag-drop-${Date.now()}`
        );

        // Get the editor's content area width for default sizing
        const editorElement = this.editor.view.dom;
        const editorWidth = editorElement.clientWidth;

        // Set image width to 95% of editor width
        const defaultWidth = Math.floor(editorWidth * 0.95);

        // Insert the image with asset URL
        this.editor.chain().focus().setImage({
          src: assetUrl,
          width: defaultWidth, // numeric value, not string
        }).run();
      } catch (error) {
        console.error('Error uploading dropped file:', error);
        alert(`Failed to upload ${file.name}. Please try again.`);
      }
    }
  }

  // Inline component interaction methods
  onInlineComponentClick(componentId: string, instanceId: string): void {
    const instance = this.componentInjectionService.getInstance(instanceId);
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  onInlineComponentDelete(instanceId: string): void {
    this.editor.commands.removeAngularComponent(instanceId);
    this.componentInjectionService.removeComponent(instanceId);
  }

  onInlineComponentEdit(instanceId: string): void {
    const instance = this.componentInjectionService.getInstance(instanceId);
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  /**
   * Embedded serialization marker so injected component state survives:
   * editor HTML -> DB -> editor HTML.
   */
  private static readonly INJECTED_COMPONENTS_META_ATTR =
    'data-ot-injected-components';

  /**
   * Safe deep copy that removes circular references
   */
  private safeCycleBreaker(obj: any, seen = new WeakSet()): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (seen.has(obj)) {
      return undefined;
    }

    seen.add(obj);

    if (Array.isArray(obj)) {
      return obj
        .map(item => this.safeCycleBreaker(item, seen))
        .filter(item => item !== undefined);
    }

    const result: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Exclude specific known dangerous keys
        if (key === 'componentRef' || key === '_innerComponentRef' || key === 'viewContainerRef') {
          continue;
        }

        const value = this.safeCycleBreaker(obj[key], seen);
        if (value !== undefined) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  private addInjectedComponentsMeta(html: string, injectedComponents: unknown): string {
    const safeHtml = html ?? '';

    // Avoid bloating output if there are no injected components.
    const hasComponents =
      Array.isArray(injectedComponents) ? injectedComponents.length > 0 : !!injectedComponents;
    if (!hasComponents) {
      // Still strip any stale meta so the stored HTML stays clean.
      return this.stripInjectedComponentsMeta(safeHtml).html;
    }

    // Pre-sanitize and simplify the payload structure
    let serializableComponents: any[] = [];
    if (Array.isArray(injectedComponents)) {
      serializableComponents = injectedComponents.map((comp: any) => {
        // Only pick what we need to minimize data and risk
        return {
          instanceId: comp.instanceId,
          componentDef: {
            id: comp?.componentDef?.id
          },
          data: this.safeCycleBreaker(comp.data),
          position: comp.position
        };
      });
    }

    const payload = {
      v: 1,
      injectedComponents: serializableComponents,
    };

    // Use a simple JSON stringify since we've already cleaned the data
    const encoded = this.base64UrlEncodeUtf8(JSON.stringify(payload));

    const doc = new DOMParser().parseFromString(safeHtml, 'text/html');

    // Remove any existing meta nodes to prevent duplicates.
    doc
      .querySelectorAll(`span[${BlogComposeComponent.INJECTED_COMPONENTS_META_ATTR}]`)
      .forEach((n) => n.remove());

    const meta = doc.createElement('span');
    meta.setAttribute(BlogComposeComponent.INJECTED_COMPONENTS_META_ATTR, encoded);
    // Ensure it stays non-visible even if style attributes are stripped.
    meta.setAttribute('hidden', '');
    meta.setAttribute('aria-hidden', 'true');

    doc.body.appendChild(meta);

    return doc.body.innerHTML;
  }

  private stripInjectedComponentsMeta(html: string): { html: string; injectedComponents?: unknown } {
    const safeHtml = html ?? '';
    const doc = new DOMParser().parseFromString(safeHtml, 'text/html');

    const meta = doc.querySelector(
      `span[${BlogComposeComponent.INJECTED_COMPONENTS_META_ATTR}]`
    ) as HTMLSpanElement | null;

    let injectedComponents: unknown | undefined;

    const encoded = meta?.getAttribute(BlogComposeComponent.INJECTED_COMPONENTS_META_ATTR);
    if (encoded) {
      try {
        const decoded = this.base64UrlDecodeUtf8(encoded);
        const parsed = JSON.parse(decoded) as { v?: number; injectedComponents?: unknown };
        if (parsed && parsed.v === 1) {
          injectedComponents = parsed.injectedComponents;
        }
      } catch {
        // Ignore malformed meta; treat as absent.
      }
    }

    meta?.remove();

    return { html: doc.body.innerHTML, injectedComponents };
  }

  private base64UrlEncodeUtf8(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const b64 = btoa(binary);
    // base64url
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private base64UrlDecodeUtf8(value: string): string {
    // base64url -> base64
    let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    // pad
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  private restoreInjectedComponentData(components: any[]): void {
    if (!components || !components.length) return;

    // We schedule this to run after the current stack, 
    // to allow Tiptap's synchronous rendering to complete first (if called immediately after setContent).
    setTimeout(() => {
      components.forEach(comp => {
        // Only restore if the component ID and instance ID are valid
        if (comp && comp.instanceId && comp.data) {
          try {
            // 1. Ensure service has the latest data
            // Note: updateComponent throws if instance not found, so we should check first
            if (this.componentInjectionService.getInstance(comp.instanceId)) {
              this.componentInjectionService.updateComponent(comp.instanceId, comp.data);
            }

            // 2. Ensure Tiptap node has the latest data
            this.editor?.commands.updateAngularComponent({
              instanceId: comp.instanceId,
              data: comp.data
            });
          } catch (e) {
            console.warn('[BlogCompose] Failed to restore component data', comp.instanceId, e);
          }
        }
      });
    }, 0);
  }

  onPostSubmit() {
    // Ensure stored content includes serialized injected component state.
    const editorHtml = this.editor?.getHTML?.() ?? this.content;
    const contentForStorage = this.addInjectedComponentsMeta(
      editorHtml,
      this.getActiveComponents()
    );

    // Extract components in new format for database persistence
    const componentsNewFormat = this.getInjectedComponentsNew();
    console.log('[BlogCompose] Emitting post with components:', componentsNewFormat);

    this.postSubmitted.emit({
      title: this.title,
      content: contentForStorage,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(), // Old format for backward compatibility
      injectedComponentsNew: componentsNewFormat, // New format for database persistence
      // themeConfig: {
      //   theme: this.postTheme,
      //   accentColor: this.postAccentColor,
      // },
    });
  }

  // ControlValueAccessor implementation


  writeValue(value: any): void {
    if (value && typeof value === 'object') {
      let componentsToRestore = value.injectedComponents;

      // Normalize content coming back from DB: extract embedded meta and
      // keep the editor-visible HTML clean.
      if (value.content && typeof value.content === 'string') {
        const extracted = this.stripInjectedComponentsMeta(value.content);
        this._content = extracted.html;

        // Use components from meta if available, as they are guaranteed to match the content version
        if (extracted.injectedComponents) {
          componentsToRestore = extracted.injectedComponents;
        }
      } else {
        this._content = value.content || '';
      }

      this._title = value.title || '';
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
        if (componentsToRestore) {
          this.restoreInjectedComponentData(componentsToRestore);
        }
      } else {
        // Queue content to be set after editor initialization
        this.pendingContent = this._content;
        this.pendingInjectedComponents = componentsToRestore || null;
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
    // Persist a storage-safe version of the content that includes injected component state.
    const contentForStorage = this.addInjectedComponentsMeta(
      this.content,
      this.getActiveComponents()
    );

    const value = {
      title: this.title,
      content: contentForStorage, // Use the version with embedded meta
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
