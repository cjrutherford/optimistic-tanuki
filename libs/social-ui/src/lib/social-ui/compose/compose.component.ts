import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  ElementRef,
  OnDestroy,
  inject,
  AfterViewInit,
  ViewContainerRef,
  ComponentRef,
  forwardRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { CreateAttachmentDto } from '@optimistic-tanuki/ui-models';
import {
  InjectedComponentData,
  ComponentInjection,
} from '@optimistic-tanuki/compose-lib';
import {
  ThemeService,
  ThemeColors,
  Themeable,
} from '@optimistic-tanuki/theme-lib';
import {
  GradientBuilder,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './extensions/resizable-image.extension';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import DOMPurify from 'dompurify';

import { ComponentInjectionService } from './services/component-injection.service';
import { SocialComposeComponentNode } from './extensions/social-compose-component.extension';
import { ComponentSelectorComponent } from './components/component-selector.component';
import { PropertyDefinition } from './components/property-editor.component';
import { RichTextToolbarComponent } from './components/rich-text-toolbar.component';
import { COMPONENT_PROPERTY_DEFINITIONS } from './configs/component-properties.config';
import { CalloutBoxComponent } from './components/example-components/callout-box.component';
import { CodeSnippetComponent } from './components/example-components/code-snippet.component';
import { ImageGalleryComponent } from './components/example-components/image-gallery.component';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionAPI,
} from './interfaces/component-injection.interface';
import { ImageUploadService } from '@optimistic-tanuki/compose-lib';

import {
  PostThemeConfig,
  DEFAULT_POST_THEME,
} from '@optimistic-tanuki/ui-models';

export interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: CreateAttachmentDto[];
  injectedComponents?: InjectedComponentInstance[]; // Old format (backward compat)
  injectedComponentsNew?: InjectedComponentData[]; // New format for DB persistence
  themeConfig?: PostThemeConfig;
}

export interface ImageUploadCallback {
  (dataUrl: string, fileName: string): Promise<string>;
}

@Component({
  selector: 'lib-social-compose',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatTooltipModule,
    TiptapEditorDirective,
    ComponentSelectorComponent,
    RichTextToolbarComponent,
    CardComponent,
    TextInputComponent,
    ButtonComponent,
  ],
  templateUrl: './compose.component.html',
  styleUrls: ['./compose.component.scss'],
  providers: [
    ComponentInjectionService,
    ImageUploadService,
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ComposeComponent),
      multi: true,
    },
  ],
})
export class ComposeComponent
  extends Themeable
  implements
    OnDestroy,
    AfterViewInit,
    ComponentInjectionAPI,
    ControlValueAccessor
{
  @Input() title = '';
  @Input() profileId?: string; // Profile ID for asset uploads
  @Input() attachments: CreateAttachmentDto[] = [];
  @Input() links: { url: string }[] = [];
  @Input() imageUploadCallback?: ImageUploadCallback;
  @Output() postSubmitted = new EventEmitter<PostData>();

  @ViewChild('editorContent') editorContent!: ElementRef;
  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  override readonly themeService: ThemeService = inject(ThemeService);

  editor: Editor | null = null;
  isDragOver = false;
  showComponentSelector = false;
  showPropertyEditor = false;
  selectedComponentId: string | null = null;
  selectedComponentType: string | null = null;
  selectedComponentProps: Record<string, unknown> = {};
  componentConfig = COMPONENT_PROPERTY_DEFINITIONS;

  // Theme properties
  override background = '#ffffff';
  override foreground = '#000000';
  override accent = '#000000';
  override complement = '#ffffff';
  override borderColor = '#e0e0e0';
  override borderGradient = 'none';
  backgroundGradient = 'none';

  // Component injection properties
  isComponentSelectorVisible = false;
  registeredComponents: InjectableComponent[] = [];
  activeComponents = new Map<string, InjectedComponentInstance>();

  // Post theme configuration properties
  isThemeConfigVisible = false;
  postTheme: 'light' | 'dark' = 'light';
  postAccentColor = '#3f51b5';

  private componentInjectionService = inject(ComponentInjectionService);
  private dialog = inject(MatDialog);
  private imageUploadService = inject(ImageUploadService);
  private cdr = inject(ChangeDetectorRef);

  private _content = '';
  private _title = '';

  // ControlValueAccessor callbacks
  onChange: (value: any) => void = () => {};
  onTouched: () => void = () => {};
  isDisabled = false;

  // Flag to track if there's pending content to set after editor init
  private pendingContent: string | null = null;
  private pendingInjectedComponents: any[] | null = null;

  @Input()
  get content(): string {
    return this._content;
  }

  set content(value: string) {
    this._content = value;
  }

  constructor() {
    super();
  }

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input);
  }

  ngAfterViewInit(): void {
    this.componentInjectionService.setViewContainer(this.componentContainer);

    // Set up callbacks for component wrapper events (matching blog-compose pattern)
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
        // Inline Component Injection extension (new persistence-friendly format)
        ComponentInjection.configure({}),
        // Angular Component rendering extension with nodeView
        SocialComposeComponentNode.configure({
          disableDefaultControls: true, // Use wrapper controls instead of decoration-based controls
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

      if (this.pendingInjectedComponents) {
        this.restoreInjectedComponentData(this.pendingInjectedComponents);
        this.pendingInjectedComponents = null;
      }
    }

    // Listen for content changes
    this.editor.on('update', () => {
      if (this.editor) {
        const newContent = this.editor.getHTML();
        if (this._content !== newContent) {
          this._content = this.sanitize(newContent);
          this.emitChange();
        }
      }
    });

    if (this.cdr) {
      this.cdr.detectChanges();
    }
  }

  override ngOnDestroy(): void {
    this.editor?.destroy();
  }

  // Component injection system initialization
  private initializeDefaultComponents(): void {
    // ============================================
    // SOCIAL UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'callout-box',
      name: 'Callout Box',
      description: 'Highlight important information with colored callout boxes',
      component: CalloutBoxComponent,
      category: 'Social',
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
      category: 'Social',
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
      category: 'Social',
      icon: 'photo_library',
      data: {
        title: 'Sample Gallery',
        columns: 3,
      },
    });

    this.registeredComponents = this.getRegisteredComponents();
  }

  // Component injection API implementation
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

  async injectComponent(
    componentId: string,
    data?: Record<string, unknown>
  ): Promise<InjectedComponentInstance> {
    const component = this.componentInjectionService
      .getRegisteredComponents()
      .find((comp) => comp.id === componentId);

    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    const instanceId = `${componentId}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Use NEW ComponentInjection extension (for future persistence format)
    this.editor?.commands.insertComponent({
      instanceId,
      componentType: componentId,
      data: data || component.data || {},
    });

    // Also use OLD system for Angular component rendering with nodeView (temporary during migration)
    this.editor?.commands.insertAngularComponent({
      componentId,
      instanceId,
      data: data || component.data || {},
      componentDef: component,
    });

    const instance = this.componentInjectionService.getInstance(instanceId);

    if (!instance) {
      throw new Error('Failed to inject component instance');
    }

    this.activeComponents.set(instanceId, instance);
    return instance;
  }

  updateComponent(instanceId: string, data: Record<string, unknown>): void {
    // Update both extensions during migration
    this.editor?.commands.updateComponent?.({
      instanceId,
      data,
    });
    this.editor?.commands.updateAngularComponent?.({
      instanceId,
      data,
    });

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
    console.log(`Moving component ${instanceId} to position ${newPosition}`);
  }

  // UI event handlers
  displayComponentSelector(): void {
    this.isComponentSelectorVisible = true;
  }

  hideComponentSelector(): void {
    this.isComponentSelectorVisible = false;
  }

  // Component action handlers (called by ComponentWrapper inline editing)
  onComponentEdit(instance: InjectedComponentInstance): void {
    // Edit is now handled inline by ComponentWrapper
    // This method is called when the edit button is clicked in the wrapper
    console.log('[Compose] Edit component:', instance.instanceId);
  }

  onComponentDelete(instance: InjectedComponentInstance): void {
    // Remove from both extensions during migration
    this.editor?.commands.removeComponent?.(instance.instanceId);
    this.editor?.commands.removeAngularComponent?.(instance.instanceId);
    this.removeComponent(instance.instanceId);
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
    // Selection is handled by the ComponentWrapper
    console.log('[Compose] Component selected:', instance.instanceId);
  }

  onComponentDuplicate(instance: InjectedComponentInstance): void {
    // Duplicate the component
    console.log('[Compose] Duplicate component:', instance.instanceId);
    const component = this.getRegisteredComponents().find(
      (c) => c.id === instance.componentDef.id
    );
    if (component) {
      this.onComponentSelected(component).then(() => {
        console.log('[Compose] Component duplicated successfully');
      });
    }
  }

  onComponentConfig(instance: InjectedComponentInstance): void {
    // Open configuration for the component
    console.log('[Compose] Config component:', instance.instanceId);
    this.onComponentEdit(instance);
  }

  onComponentPropertiesChanged(event: {
    instance: InjectedComponentInstance;
    data: Record<string, unknown>;
  }): void {
    // Update component data from inline editor (updates both extensions)
    this.updateComponent(event.instance.instanceId, event.data);

    // Emit change for form integration
    this.emitChange();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }

    const file = input.files[0];

    try {
      // If custom callback is provided, use it
      if (this.imageUploadCallback) {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Src = reader.result as string;
            if (base64Src && this.imageUploadCallback) {
              const uploadedUrl = await this.imageUploadCallback(
                base64Src,
                file.name
              );
              this.editor?.chain().focus().setImage({ src: uploadedUrl }).run();
            }
          } catch (error) {
            console.error('Error in image upload callback:', error);
            alert('Failed to upload image. Please try again.');
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Upload to Assets service (requires profileId)
        if (!this.profileId) {
          console.error('Profile ID is required for image upload');
          alert('Unable to upload image: User profile not found');
          input.value = '';
          return;
        }

        const assetUrl = await this.imageUploadService.uploadFile(
          file,
          this.profileId,
          `social-image-${Date.now()}`
        );

        this.editor?.chain().focus().setImage({ src: assetUrl }).run();
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      input.value = '';
    }
  }

  onToolbarComponentsClick(): void {
    this.displayComponentSelector();
  }

  onToolbarImageUploadClick(): void {
    const fileInput = document.getElementById('imageInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  // Inline component interaction methods
  onInlineComponentClick(componentId: string, instanceId: string): void {
    const instance = this.getActiveComponents().find(
      (comp) => comp.instanceId === instanceId
    );
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  onInlineComponentDelete(instanceId: string): void {
    // Remove from both extensions during migration
    this.editor?.commands.removeComponent?.(instanceId);
    this.editor?.commands.removeAngularComponent?.(instanceId);
    this.removeComponent(instanceId);
  }

  onInlineComponentEdit(instanceId: string): void {
    const instance = this.getActiveComponents().find(
      (comp) => comp.instanceId === instanceId
    );
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  async onComponentSelected(component: InjectableComponent): Promise<void> {
    try {
      const instanceId = `${component.id}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 9)}`;

      // Use NEW ComponentInjection extension (for future persistence format)
      this.editor?.commands.insertComponent({
        instanceId,
        componentType: component.id,
        data: component.data || {},
      });

      // Also use OLD system for Angular component rendering with nodeView (temporary during migration)
      this.editor?.commands.insertAngularComponent({
        componentId: component.id,
        instanceId,
        data: component.data || {},
        componentDef: component,
      });

      // Move cursor to a new paragraph after the inserted component
      if (this.editor?.state?.selection) {
        this.editor
          .chain()
          .insertContentAt(this.editor.state.selection.to, {
            type: 'paragraph',
          })
          .focus()
          .run();
      }

      const mockComponentRef = {
        instance: component.data || {},
        changeDetectorRef: { detectChanges: () => ({}) },
        destroy: () => ({}),
      } as unknown;

      const injectedInstance: InjectedComponentInstance = {
        instanceId,
        componentDef: component,
        componentRef: mockComponentRef as ComponentRef<unknown>,
        data: component.data || {},
      };

      this.activeComponents.set(instanceId, injectedInstance);
      this.hideComponentSelector();

      // Emit change for form integration
      this.emitChange();
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

  async handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault();
    this.isDragOver = false;

    if (!e.dataTransfer?.files.length) return;

    const files = Array.from(e.dataTransfer.files);

    // Filter for image files only
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please drop image files only');
      return;
    }

    // Upload each image file to Assets service
    for (const file of imageFiles) {
      try {
        // If custom callback is provided, use it
        if (this.imageUploadCallback) {
          const reader = new FileReader();
          reader.onload = async (event: ProgressEvent<FileReader>) => {
            try {
              const base64Src = event.target?.result as string;
              if (base64Src) {
                const uploadedUrl = await this.imageUploadCallback!(
                  base64Src,
                  file.name
                );
                this.editor
                  ?.chain()
                  .focus()
                  .setImage({ src: uploadedUrl })
                  .run();
              }
            } catch (error) {
              console.error('Error in image upload callback:', error);
              alert(`Failed to upload ${file.name}. Please try again.`);
            }
          };
          reader.readAsDataURL(file);
        } else {
          // Upload to Assets service (requires profileId)
          if (!this.profileId) {
            console.error('Profile ID is required for image upload');
            alert('Unable to upload image: User profile not found');
            return;
          }

          const assetUrl = await this.imageUploadService.uploadFile(
            file,
            this.profileId,
            `social-drag-drop-${Date.now()}`
          );

          this.editor?.chain().focus().setImage({ src: assetUrl }).run();
        }
      } catch (error) {
        console.error('Error uploading dropped file:', error);
        alert(`Failed to upload ${file.name}. Please try again.`);
      }
    }
  }

  /**
   * Extract injected components from editor for database persistence
   * Traverses the editor document and collects all component nodes
   */
  getInjectedComponentsNew(): InjectedComponentData[] {
    const components: InjectedComponentData[] = [];

    if (!this.editor) {
      return components;
    }

    this.editor.state.doc.descendants((node: any) => {
      // Check for all component node types (for cross-compatibility)
      if (
        node.type.name === 'socialComposeComponent' ||
        node.type.name === 'blogComposeComponent' ||
        node.type.name === 'angularComponent'
      ) {
        components.push({
          instanceId: node.attrs['instanceId'],
          componentType: node.attrs['componentId'],
          componentData: node.attrs['data'] || {},
          position: components.length,
        });
      }
    });

    console.log('[SocialCompose] Extracted components:', components);
    return components;
  }

  async onPostSubmit(): Promise<void> {
    let finalContent = this.content;

    // If an image upload callback is provided, process images
    if (this.imageUploadCallback) {
      const images = this.imageUploadService.extractBase64Images(this.content);

      if (images.length > 0) {
        const replacements: Array<{ dataUrl: string; assetUrl: string }> = [];

        // Upload each image and collect replacements
        for (const image of images) {
          try {
            const fileName = `image_${Date.now()}_${Math.random()
              .toString(36)
              .substring(2, 9)}`;
            const assetUrl = await this.imageUploadCallback(
              image.dataUrl,
              fileName
            );
            replacements.push({ dataUrl: image.dataUrl, assetUrl });
          } catch (error) {
            console.error('Failed to upload image:', error);
            // Continue with other images even if one fails
          }
        }

        // Replace all base64 URLs with asset URLs
        if (replacements.length > 0) {
          finalContent = this.imageUploadService.replaceImageUrls(
            this.content,
            replacements
          );
        }
      }
    }

    // Extract components in new format for database persistence
    const componentsNewFormat = this.getInjectedComponentsNew();

    // DO NOT reset the editor state - keep it open for continued editing
    // This fixes the glitch where the editor closes on initial save
    this.postSubmitted.emit({
      title: this.title,
      content: finalContent,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(), // Old format (backward compat)
      injectedComponentsNew: componentsNewFormat, // New format for DB
      themeConfig: {
        theme: this.postTheme,
        accentColor: this.postAccentColor,
      },
    });
  }

  /**
   * Reset the editor to initial state
   * Call this explicitly when you want to clear the editor (e.g., after successful post creation with component persistence)
   */
  resetEditor(): void {
    this._title = '';
    this.title = '';
    this._content = '';
    this.links = [];
    this.attachments = [];
    this.activeComponents.clear();
    this.postTheme = DEFAULT_POST_THEME.theme;
    this.postAccentColor = DEFAULT_POST_THEME.accentColor;

    if (this.editor) {
      this.editor.commands.setContent('');
      this.editor.commands.focus();
    }
    this.emitChange();
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

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.tertiary;
    this.borderGradient = new GradientBuilder()
      .setType('linear')
      .setOptions({
        direction: '90deg',
        colors: [colors.accent, colors.complementary],
      })
      .build();
    this.backgroundGradient = new GradientBuilder()
      .setType('linear')
      .setOptions({
        direction: '180deg',
        colors: [colors.background, colors.tertiary],
      })
      .build();
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
  }

  // ==================== ControlValueAccessor Implementation ====================

  writeValue(value: any): void {
    if (value && typeof value === 'object') {
      let componentsToRestore = value.injectedComponents;

      // Normalize content coming back from DB
      if (value.content && typeof value.content === 'string') {
        const extracted = this.stripInjectedComponentsMeta(value.content);
        this._content = extracted.html;

        // Use components from meta if available
        if (extracted.injectedComponents) {
          componentsToRestore = extracted.injectedComponents;
        }
      } else {
        this._content = value.content || '';
      }

      this._title = value.title || '';
      this.title = this._title; // Update the input property
      this.links = value.links || [];
      this.attachments = value.attachments || [];

      // Load post theme configuration
      if (value.themeConfig) {
        this.postTheme = value.themeConfig.theme || DEFAULT_POST_THEME.theme;
        this.postAccentColor =
          value.themeConfig.accentColor || DEFAULT_POST_THEME.accentColor;
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
    this.isDisabled = isDisabled;
    if (this.editor) {
      this.editor.setEditable(!isDisabled);
    }
  }

  private emitChange(): void {
    const contentForStorage = this.addInjectedComponentsMeta(
      this.content,
      this.getActiveComponents()
    );

    const value = {
      title: this.title,
      content: contentForStorage,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(),
      injectedComponentsNew: this.getInjectedComponentsNew(),
      themeConfig: {
        theme: this.postTheme,
        accentColor: this.postAccentColor,
      },
    };
    this.onChange(value);
    this.onTouched();
  }

  // ==================== Component Persistence Helpers ====================

  private restoreInjectedComponentData(components: any[]): void {
    if (!components || !components.length) return;

    setTimeout(() => {
      components.forEach((comp) => {
        if (comp && comp.instanceId) {
          try {
            // Ensure wrapper exists; if not, render into existing placeholder
            const placeholder = this.editor?.view?.dom?.querySelector(
              `[data-angular-component][data-instance-id="${comp.instanceId}"]`
            ) as HTMLElement | null;
            if (
              placeholder &&
              !this.componentInjectionService.getInstance(comp.instanceId)
            ) {
              const componentId =
                placeholder.getAttribute('data-component-id') ||
                comp.componentId ||
                comp.componentType;
              if (componentId) {
                this.componentInjectionService.renderComponentInto(
                  componentId,
                  comp.instanceId,
                  comp.data || {},
                  placeholder
                );
              }
            }

            // Update service instance if present
            if (
              this.componentInjectionService.getInstance(comp.instanceId) &&
              comp.data
            ) {
              this.componentInjectionService.updateComponent(
                comp.instanceId,
                comp.data
              );
            }

            // Update TipTap node data in both extensions during migration
            if (comp.data) {
              this.editor?.commands.updateComponent?.({
                instanceId: comp.instanceId,
                data: comp.data,
              });
              this.editor?.commands.updateAngularComponent?.({
                instanceId: comp.instanceId,
                data: comp.data,
              });
            }
          } catch (e) {
            console.warn(
              '[SocialCompose] Failed to restore component data',
              comp.instanceId,
              e
            );
          }
        }
      });
    }, 0);
  }

  private addInjectedComponentsMeta(
    content: string,
    components: InjectedComponentInstance[]
  ): string {
    if (!components || components.length === 0) return content;

    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    components.forEach((comp) => {
      const placeholders = doc.querySelectorAll(
        `[data-angular-component][data-instance-id="${comp.instanceId}"]`
      );
      placeholders.forEach((placeholder) => {
        // Store component data as base64 encoded JSON in data attribute
        const dataStr = JSON.stringify(comp.data || {});
        const base64Data = this.base64UrlEncodeUtf8(dataStr);
        placeholder.setAttribute('data-component-data-base64', base64Data);
      });
    });

    return doc.documentElement.innerHTML;
  }

  private stripInjectedComponentsMeta(content: string): {
    html: string;
    injectedComponents?: any[];
  } {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    const components: any[] = [];

    const placeholders = doc.querySelectorAll('[data-angular-component]');
    placeholders.forEach((placeholder) => {
      const base64Data = placeholder.getAttribute('data-component-data-base64');
      if (base64Data) {
        try {
          const dataStr = this.base64UrlDecodeUtf8(base64Data);
          const data = JSON.parse(dataStr);
          const instanceId = placeholder.getAttribute('data-instance-id');
          const componentId = placeholder.getAttribute('data-component-id');
          if (instanceId && componentId) {
            components.push({
              instanceId,
              componentId,
              data,
            });
          }
          // Clean the attribute after extraction
          placeholder.removeAttribute('data-component-data-base64');
        } catch (e) {
          console.warn('[SocialCompose] Failed to decode component data', e);
        }
      }
    });

    return {
      html: doc.documentElement.innerHTML,
      injectedComponents: components.length > 0 ? components : undefined,
    };
  }

  private base64UrlEncodeUtf8(value: string): string {
    const utf8Bytes = new TextEncoder().encode(value);
    let binary = '';
    utf8Bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  private base64UrlDecodeUtf8(value: string): string {
    let b64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
}
