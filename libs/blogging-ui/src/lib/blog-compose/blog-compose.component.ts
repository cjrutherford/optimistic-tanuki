import {
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  OnInit,
  HostListener,
  ViewChild,
  ViewContainerRef,
  AfterViewInit,
  inject,
  forwardRef,
} from '@angular/core';

import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MatIconModule } from '@angular/material/icon';
import { TiptapEditorDirective } from 'ngx-tiptap';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';
import { GradientBuilder } from '@optimistic-tanuki/common-ui';
import { 
  ButtonComponent, 
  CardComponent, 
  AccordionComponent,
  ModalComponent,
  HeroSectionComponent,
  ContentSectionComponent 
} from '@optimistic-tanuki/common-ui';
import { 
  TextAreaComponent, 
  TextInputComponent,
  CheckboxComponent,
  SelectComponent,
  RadioButtonComponent
} from '@optimistic-tanuki/form-ui';
import { ContextMenuComponent } from '../context-menu/context-menu.component';

// Component injection system imports
import { ComponentInjectionService } from './services/component-injection.service';
import { ComponentSelectorComponent } from './components/component-selector.component';
import { 
  InjectableComponent, 
  InjectedComponentInstance,
  ComponentInjectionAPI 
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
import { PropertyEditorComponent, PropertyDefinition } from './components/property-editor.component';
import { ComponentWrapperComponent } from './components/component-wrapper.component';
import { ComponentEditorWrapperComponent } from './components/component-editor-wrapper.component';
import { COMPONENT_PROPERTY_DEFINITIONS } from './configs/component-properties.config';

// Rich text toolbar
import { RichTextToolbarComponent } from './components/rich-text-toolbar.component';

// Angular Component Node Extension
import { AngularComponentNode } from './extensions/angular-component-node.extension';

interface PostData {
  title: string;
  content: string;
  links: { url: string }[];
  attachments: File[];
  injectedComponents?: InjectedComponentInstance[];
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
    ComponentWrapperComponent,
    ComponentEditorWrapperComponent,
    RichTextToolbarComponent,
    TextAreaComponent,
    TiptapEditorDirective,
],
  templateUrl: './blog-compose.component.html',
  styleUrls: ['./blog-compose.component.scss'],
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
    }
  ]
})
export class BlogComposeComponent extends Themeable implements OnInit, OnDestroy, AfterViewInit, ComponentInjectionAPI, ControlValueAccessor {
  @Output() postSubmitted: EventEmitter<PostData> = new EventEmitter<PostData>();
  @Output() attachmentAdded = new EventEmitter<{
    placeholderId: string;
    file: File;
  }>();

  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  override readonly themeService: ThemeService = inject(ThemeService);
  
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

  // Property editing properties
  isPropertyEditorVisible = false;
  selectedComponentInstance: InjectedComponentInstance | null = null;
  selectedComponentProperties: PropertyDefinition[] = [];

  constructor(private componentInjectionService: ComponentInjectionService, _theme: ThemeService) {
    super(_theme);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isContextMenuVisible = false;
    this.selectedComponentInstance = null;
  }

  ngAfterViewInit(): void {
    // The component container is no longer needed as components are now inline in the editor
    this.initializeDefaultComponents();
  }

  override ngOnInit(): void {
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
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prosemirror-editor',
        },
      },
      content: this._content,
    });

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
        this._content = newContent;
        this.emitChange();
      }
    });
  }

  override ngOnDestroy(): void {
    this.editor.destroy();
    // Clear our inline components
    this.activeComponents.clear();
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
        content: 'This is an important callout box.'
      }
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
        code: 'console.log("Hello, World!");'
      }
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
        columns: 3
      }
    });

    this.registerComponent({
      id: 'hero',
      name: 'Hero Section',
      description: 'Eye-catching hero section with title, description, and call-to-action',
      component: HeroComponent,
      category: 'Blogging',
      icon: 'landscape',
      data: {
        title: 'Welcome to Our Blog!',
        subtitle: '',
        description: 'Discover the latest news, tips, and stories from our community.',
        buttonText: 'Get Started',
        imageUrl: 'https://via.placeholder.com/600x400'
      }
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
            excerpt: 'A deep dive into the principles and benefits of microservices.',
            authorName: 'Jane Doe',
            publishDate: '2024-05-10',
            readMoreLink: '/blog/microservices-architecture'
          }
        ]
      }
    });

    this.registerComponent({
      id: 'newsletter-signup',
      name: 'Newsletter Signup',
      description: 'Collect email subscriptions with an attractive signup form',
      component: NewsletterSignupComponent,
      category: 'Blogging',
      icon: 'email',
      data: {
        bannerImage: 'https://picsum.photos/1200/300'
      }
    });

    // ============================================
    // COMMON UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'common-card',
      name: 'Card',
      description: 'A styled card container for organizing content with optional glass effect',
      component: CardComponent,
      category: 'Common UI',
      icon: 'dashboard',
      data: {
        glassEffect: false,
        CardVariant: 'default'
      }
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
        label: 'Click Me'
      }
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
          { heading: 'Section 2', content: 'Content for section 2' }
        ]
      }
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
        size: 'md'
      }
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
        alignment: 'center'
      }
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
        layout: 'single-column'
      }
    });

    // ============================================
    // FORM UI COMPONENTS
    // ============================================

    this.registerComponent({
      id: 'form-text-input',
      name: 'Text Input',
      description: 'Single-line text input field with label and placeholder support',
      component: TextInputComponent,
      category: 'Form UI',
      icon: 'text_fields',
      data: {
        type: 'text',
        label: 'Text Input',
        placeholder: 'Enter text...',
        labelPosition: 'top'
      }
    });

    this.registerComponent({
      id: 'form-checkbox',
      name: 'Checkbox',
      description: 'Checkbox input for boolean selections',
      component: CheckboxComponent,
      category: 'Form UI',
      icon: 'check_box',
      data: {
        value: false
      }
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
          { value: 'option3', label: 'Option 3' }
        ]
      }
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
          { label: 'Option 2', value: 'option2' }
        ],
        layout: 'vertical',
        selected: ''
      }
    });

    this.registerComponent({
      id: 'form-text-area',
      name: 'Text Area',
      description: 'Multi-line text input for longer content',
      component: TextAreaComponent,
      category: 'Form UI',
      icon: 'notes',
      data: {
        label: 'Text Area'
      }
    });

    this.registeredComponents = this.getRegisteredComponents();
  }

  // Component injection API implementation (now working with inline editor)
  registerComponent(component: InjectableComponent): void {
    // Keep using the service for registration as it manages the component definitions
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

  async injectComponent(componentId: string, data?: any, position?: number): Promise<InjectedComponentInstance> {
    // Use our new inline injection method instead
    const component = this.componentInjectionService.getRegisteredComponents()
      .find(comp => comp.id === componentId);
    
    if (!component) {
      throw new Error(`Component ${componentId} not found`);
    }

    const instanceId = `${componentId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Insert into TipTap editor
    this.editor.commands.insertAngularComponent({
      componentId,
      instanceId,
      data: data || component.data || {},
      componentDef: component,
    });

    // Track the component
    const mockComponentRef = {
      instance: data || component.data || {},
      changeDetectorRef: { detectChanges: () => {} },
      destroy: () => {},
    } as any;

    const injectedInstance: InjectedComponentInstance = {
      instanceId,
      componentDef: component,
      componentRef: mockComponentRef,
      data: data || component.data || {},
    };

    this.activeComponents.set(instanceId, injectedInstance);
    return injectedInstance;
  }

  // Override component injection methods to work with inline editor
  updateComponent(instanceId: string, data: any): void {
    const instance = this.activeComponents.get(instanceId);
    if (instance) {
      instance.data = { ...instance.data, ...data };
      this.activeComponents.set(instanceId, instance);
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

  // UI event handlers
  showComponentSelector(): void {
    this.isComponentSelectorVisible = true;
  }

  hideComponentSelector(): void {
    this.isComponentSelectorVisible = false;
  }


  // Property editing methods
  onComponentEdit(instance: InjectedComponentInstance): void {
    this.selectedComponentInstance = instance;
    this.selectedComponentProperties = COMPONENT_PROPERTY_DEFINITIONS[instance.componentDef.id] || [];
    this.isPropertyEditorVisible = true;
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
    const currentIndex = activeComponents.findIndex(c => c.instanceId === instance.instanceId);
    if (currentIndex > 0) {
      this.moveComponent(instance.instanceId, currentIndex - 1);
    }
  }

  onComponentMoveDown(instance: InjectedComponentInstance): void {
    const activeComponents = this.getActiveComponents();
    const currentIndex = activeComponents.findIndex(c => c.instanceId === instance.instanceId);
    if (currentIndex < activeComponents.length - 1) {
      this.moveComponent(instance.instanceId, currentIndex + 1);
    }
  }

  onComponentSelection(instance: InjectedComponentInstance): void {
    this.selectedComponentInstance = instance;
  }

  onPropertiesUpdated(updatedData: any): void {
    if (this.selectedComponentInstance) {
      // Handle output configuration
      const outputConfigs: any = {};
      this.selectedComponentProperties.forEach(prop => {
        if (prop.isOutput) {
          const url = updatedData[prop.key + '_url'];
          if (url) {
            outputConfigs[prop.key] = {
              url,
              schema: prop.outputSchema
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
      const innerComponentRef = this.selectedComponentInstance.data._innerComponentRef;
      if (innerComponentRef) {
        Object.keys(finalData).forEach(key => {
          if (key !== '_innerComponentRef' && key !== '_outputConfigs' && 
              innerComponentRef.instance[key] !== undefined) {
            innerComponentRef.instance[key] = finalData[key];
          }
        });
        innerComponentRef.changeDetectorRef.detectChanges();
      }

      this.updateComponent(this.selectedComponentInstance.instanceId, finalData);
      
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
    const instance = this.getActiveComponents().find(comp => comp.instanceId === instanceId);
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
    const instance = this.getActiveComponents().find(comp => comp.instanceId === instanceId);
    if (instance) {
      this.onComponentEdit(instance);
    }
  }

  // Modified component injection to work with inline editor
  async onComponentSelected(component: InjectableComponent): Promise<void> {
    try {
      const instanceId = `${component.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Insert into TipTap editor instead of separate container
      this.editor.commands.insertAngularComponent({
        componentId: component.id,
        instanceId: instanceId,
        data: component.data || {},
        componentDef: component,
      });

      // Still track the component in our system for editing
      const mockComponentRef = {
        instance: component.data || {},
        changeDetectorRef: { detectChanges: () => {} },
        destroy: () => {},
      } as any;

      const injectedInstance: InjectedComponentInstance = {
        instanceId,
        componentDef: component,
        componentRef: mockComponentRef,
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
      const placeholderId = `upload-${Date.now()}-${Math
        .random()
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
    });
  }

  // ControlValueAccessor implementation
  private onChange = (value: any) => {};
  private onTouched = () => {};

  writeValue(value: any): void {
    if (value && typeof value === 'object') {
      this._title = value.title || '';
      this._content = value.content || '';
      this.links = value.links || [];
      this.attachments = value.attachments || [];
      
      // Update editor content if editor is available
      if (this.editor) {
        this.editor.commands.setContent(this._content);
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
      .setOptions({ shape: 'ellipse', position: 'center', colors: [colors.accent, colors.complementary] })
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