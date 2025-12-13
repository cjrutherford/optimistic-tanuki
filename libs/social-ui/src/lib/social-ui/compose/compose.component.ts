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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
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
import Image from '@tiptap/extension-image';
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
import { AngularComponentNode } from './extensions/angular-component-node.extension';
import { ComponentSelectorComponent } from './components/component-selector.component';
import {
  PropertyEditorComponent,
  PropertyDefinition,
} from './components/property-editor.component';
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
import { ImageUploadService } from './services/image-upload.service';

export interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: CreateAttachmentDto[];
  injectedComponents?: InjectedComponentInstance[];
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
    PropertyEditorComponent,
    RichTextToolbarComponent,
    CardComponent,
    TextInputComponent,
    ButtonComponent,
  ],
  templateUrl: './compose.component.html',
  styleUrls: ['./compose.component.scss'],
  providers: [ComponentInjectionService, ImageUploadService],
})
export class ComposeComponent
  extends Themeable
  implements OnDestroy, AfterViewInit, ComponentInjectionAPI
{
  @Input() title = '';
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

  // Property editing properties
  isPropertyEditorVisible = false;
  selectedComponentInstance: InjectedComponentInstance | null = null;
  selectedComponentProperties: PropertyDefinition[] = [];

  private componentInjectionService = inject(ComponentInjectionService);
  private dialog = inject(MatDialog);
  private imageUploadService = inject(ImageUploadService);

  private _content = '';

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

    // Set up callbacks for component wrapper events
    this.componentInjectionService.setWrapperCallbacks({
      onEdit: (instance) => this.onComponentEdit(instance),
      onDelete: (instance) => this.onComponentDelete(instance),
      onMoveUp: (instance) => this.onComponentMoveUp(instance),
      onMoveDown: (instance) => this.onComponentMoveDown(instance),
      onSelection: (instance) => this.onComponentSelection(instance),
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
        AngularComponentNode.configure({
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

    // Listen for content changes
    this.editor.on('update', () => {
      if (this.editor) {
        const newContent = this.editor.getHTML();
        if (this._content !== newContent) {
          this._content = this.sanitize(newContent);
        }
      }
    });
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

    // Insert into TipTap editor
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
    this.editor?.commands.updateAngularComponent({
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

  // Property editing methods
  onComponentEdit(instance: InjectedComponentInstance): void {
    this.selectedComponentInstance = instance;
    this.selectedComponentProperties =
      COMPONENT_PROPERTY_DEFINITIONS[instance.componentDef.id] || [];
    this.isPropertyEditorVisible = true;
  }

  onComponentDelete(instance: InjectedComponentInstance): void {
    this.editor?.commands.removeAngularComponent(instance.instanceId);
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

  onPropertiesUpdated(updatedData: Record<string, unknown>): void {
    if (this.selectedComponentInstance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const innerComponentRef = (this.selectedComponentInstance.data as any)[
        '_innerComponentRef'
      ];

      if (innerComponentRef) {
        Object.keys(updatedData).forEach((key) => {
          if (
            key !== '_innerComponentRef' &&
            innerComponentRef.instance &&
            innerComponentRef.instance[key] !== undefined
          ) {
            innerComponentRef.instance[key] = updatedData[key];
          }
        });
        if (innerComponentRef.changeDetectorRef) {
          innerComponentRef.changeDetectorRef.detectChanges();
        }
      }

      this.updateComponent(
        this.selectedComponentInstance.instanceId,
        updatedData
      );

      this.editor?.commands.updateAngularComponent({
        instanceId: this.selectedComponentInstance.instanceId,
        data: updatedData,
      });

      this.hidePropertyEditor();
    }
  }

  hidePropertyEditor(): void {
    this.isPropertyEditorVisible = false;
    this.selectedComponentInstance = null;
    this.selectedComponentProperties = [];
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
        this.editor?.chain().focus().setImage({ src: base64Src }).run();
      }
    };

    reader.readAsDataURL(file);
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
    this.editor?.commands.removeAngularComponent(instanceId);
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

      this.editor?.commands.insertAngularComponent({
        componentId: component.id,
        instanceId: instanceId,
        data: component.data || {},
        componentDef: component,
      });

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
      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const base64Src = event.target?.result as string;
        if (base64Src) {
          this.editor?.chain().focus().setImage({ src: base64Src }).run();
        }
      };
      reader.readAsDataURL(file);
    });
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
            const fileName = `image_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const assetUrl = await this.imageUploadCallback(image.dataUrl, fileName);
            replacements.push({ dataUrl: image.dataUrl, assetUrl });
          } catch (error) {
            console.error('Failed to upload image:', error);
            // Continue with other images even if one fails
          }
        }
        
        // Replace all base64 URLs with asset URLs
        if (replacements.length > 0) {
          finalContent = this.imageUploadService.replaceImageUrls(this.content, replacements);
        }
      }
    }

    this.postSubmitted.emit({
      title: this.title,
      content: finalContent,
      links: this.links,
      attachments: this.attachments,
      injectedComponents: this.getActiveComponents(),
    });
    
    this.title = '';
    this.content = '';
    this.links = [];
    this.attachments = [];
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
}
