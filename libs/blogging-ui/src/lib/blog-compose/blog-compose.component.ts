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

import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
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

  constructor(private componentInjectionService: ComponentInjectionService) {
    super();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isContextMenuVisible = false;
  }

  ngAfterViewInit(): void {
    if (this.componentContainer) {
      this.componentInjectionService.setViewContainer(this.componentContainer);
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