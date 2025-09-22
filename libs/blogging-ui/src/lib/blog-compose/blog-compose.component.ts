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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { MatIconModule } from '@angular/material/icon';
import { TiptapEditorDirective } from 'ngx-tiptap';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';

import { Themeable, ThemeColors, ThemeService } from '@optimistic-tanuki/theme-ui';
import { GradientBuilder } from '@optimistic-tanuki/common-ui';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
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
import { COMPONENT_PROPERTY_DEFINITIONS } from './configs/component-properties.config';

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
    CommonModule,
    FormsModule,
    TiptapEditorDirective,
    CardComponent,
    TextInputComponent,
    ButtonComponent,
    MatIconModule,
    ContextMenuComponent,
    ComponentSelectorComponent,
    PropertyEditorComponent,
    ComponentWrapperComponent,
  ],
  templateUrl: './blog-compose.component.html',
  styleUrls: ['./blog-compose.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--background]': 'background',
    '[style.--background-gradient]': 'backgroundGradient',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
  providers: [ComponentInjectionService]
})
export class BlogComposeComponent extends Themeable implements OnInit, OnDestroy, AfterViewInit, ComponentInjectionAPI {
  @Output() postSubmitted: EventEmitter<PostData> = new EventEmitter<PostData>();
  @Output() attachmentAdded = new EventEmitter<{
    placeholderId: string;
    file: File;
  }>();

  override readonly themeService: ThemeService;

  @ViewChild('componentContainer', { read: ViewContainerRef })
  componentContainer!: ViewContainerRef;

  backgroundGradient = 'linear-gradient(to right, #5969c3, #59c360)';
  isDragOver = false;
  title = '';
  content = '';
  links: Array<{ url: string }> = [];
  attachments: File[] = [];

  editor!: Editor;

  isContextMenuVisible = false;
  contextMenuX = 0;
  contextMenuY = 0;

  // Component injection properties
  isComponentSelectorVisible = false;
  registeredComponents: InjectableComponent[] = [];

  // Property editing properties
  isPropertyEditorVisible = false;
  selectedComponentInstance: InjectedComponentInstance | null = null;
  selectedComponentProperties: PropertyDefinition[] = [];

  constructor(private componentInjectionService: ComponentInjectionService, _themeService: ThemeService) {
    super(_themeService);
    this.themeService = _themeService;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isContextMenuVisible = false;
    this.selectedComponentInstance = null;
  }

  ngAfterViewInit(): void {
    if (this.componentContainer) {
      this.componentInjectionService.setViewContainer(this.componentContainer);
      
      // Set up wrapper event callbacks
      this.componentInjectionService.setWrapperCallbacks({
        onEdit: (instance) => this.onComponentEdit(instance),
        onDelete: (instance) => this.onComponentDelete(instance),
        onMoveUp: (instance) => this.onComponentMoveUp(instance),
        onMoveDown: (instance) => this.onComponentMoveDown(instance),
        onSelection: (instance) => this.onComponentSelection(instance)
      });
    }
    this.initializeDefaultComponents();
  }

  override ngOnInit(): void {
    this.editor = new Editor({
      extensions: [
        StarterKit,
        Image,
        Subscript,
        Superscript,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      editorProps: {
        attributes: {
          class: 'prosemirror-editor',
        },
      },
      content: this.content,
    });

    this.editor.view.dom.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.contextMenuX = event.clientX;
      this.contextMenuY = event.clientY;
      this.isContextMenuVisible = true;
    });
  }

  override ngOnDestroy(): void {
    this.editor.destroy();
    this.componentInjectionService.clearAllComponents();
  }

  // Component injection system initialization
  private initializeDefaultComponents(): void {
    this.registerComponent({
      id: 'callout-box',
      name: 'Callout Box',
      description: 'Highlight important information with colored callout boxes',
      component: CalloutBoxComponent,
      category: 'Content',
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
      category: 'Content',
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
      category: 'Media',
      icon: 'photo_library',
      data: {
        title: 'Sample Gallery',
        columns: 3
      }
    });

    // Add existing blogging components
    this.registerComponent({
      id: 'hero',
      name: 'Hero Section',
      description: 'Eye-catching hero section with title, description, and call-to-action',
      component: HeroComponent,
      category: 'Layout',
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
      category: 'Content',
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
      category: 'Interactive',
      icon: 'email',
      data: {
        bannerImage: 'https://picsum.photos/1200/300'
      }
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

  async injectComponent(componentId: string, data?: any, position?: number): Promise<InjectedComponentInstance> {
    return this.componentInjectionService.injectComponent(componentId, data, position);
  }

  removeComponent(instanceId: string): void {
    this.componentInjectionService.removeComponent(instanceId);
  }

  updateComponent(instanceId: string, data: any): void {
    this.componentInjectionService.updateComponent(instanceId, data);
  }

  getActiveComponents(): InjectedComponentInstance[] {
    return this.componentInjectionService.getActiveComponents();
  }

  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.componentInjectionService.getComponent(instanceId);
  }

  moveComponent(instanceId: string, newPosition: number): void {
    this.componentInjectionService.moveComponent(instanceId, newPosition);
  }

  // UI event handlers
  showComponentSelector(): void {
    this.isComponentSelectorVisible = true;
  }

  hideComponentSelector(): void {
    this.isComponentSelectorVisible = false;
  }

  async onComponentSelected(component: InjectableComponent): Promise<void> {
    try {
      await this.injectComponent(component.id);
      this.hideComponentSelector();
    } catch (error) {
      console.error('Error injecting component:', error);
    }
  }

  // Property editing methods
  onComponentEdit(instance: InjectedComponentInstance): void {
    this.selectedComponentInstance = instance;
    this.selectedComponentProperties = COMPONENT_PROPERTY_DEFINITIONS[instance.componentDef.id] || [];
    this.isPropertyEditorVisible = true;
  }

  onComponentDelete(instance: InjectedComponentInstance): void {
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

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.backgroundGradient = new GradientBuilder()
      .setType('radial')
      .setOptions({ shape: 'ellipse', position: 'center', colors: [colors.accent, colors.complementary] })
      .build();
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
    this.transitionDuration = '0.3s';
  }

}