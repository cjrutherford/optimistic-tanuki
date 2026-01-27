import {
  Component,
  EventEmitter,
  Output,
  Input,
  OnDestroy,
  AfterViewInit,
  inject,
  forwardRef,
} from '@angular/core';
import { FormsModule, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TiptapEditorDirective } from 'ngx-tiptap';
import DOMPurify from 'dompurify';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent, SelectComponent } from '@optimistic-tanuki/form-ui';
import { RichTextToolbarComponent } from '@optimistic-tanuki/social-ui';
import { Themeable, ThemeService, ThemeColors } from '@optimistic-tanuki/theme-lib';

import { TopicDto, ThreadDto } from '../models';

export interface ForumPostData {
  content: string;
  topicId?: string;
  threadId?: string;
  newTopicName?: string;
  newThreadTitle?: string;
  tags?: string[];
}

@Component({
  selector: 'lib-compose-forum-post',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    TextInputComponent,
    SelectComponent,
    TiptapEditorDirective,
    RichTextToolbarComponent,
  ],
  templateUrl: './compose-forum-post.component.html',
  styleUrls: ['./compose-forum-post.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ComposeForumPostComponent),
      multi: true,
    },
  ],
})
export class ComposeForumPostComponent
  extends Themeable
  implements OnDestroy, AfterViewInit, ControlValueAccessor
{
  @Input() availableTopics: TopicDto[] = [];
  @Input() availableThreads: ThreadDto[] = [];
  @Input() preselectedTopicId?: string;
  @Input() preselectedThreadId?: string;
  @Output() postSubmitted = new EventEmitter<ForumPostData>();
  @Output() topicCreated = new EventEmitter<string>();
  @Output() threadCreated = new EventEmitter<{ title: string; topicId: string }>();

  override readonly themeService: ThemeService = inject(ThemeService);

  editor: Editor | null = null;
  content = '';
  selectedTopicId = '';
  selectedThreadId = '';
  newTopicName = '';
  newThreadTitle = '';
  tags: string[] = [];
  newTag = '';
  
  showNewTopicInput = false;
  showNewThreadInput = false;

  // Control Value Accessor methods
  private onChange = (value: string) => {};
  private onTouched = () => {};

  // Themeable overrides
  override background = '';
  override foreground = '';
  override accent = '';
  override complement = '';
  override borderColor = '';
  override borderGradient = '';

  override applyTheme(theme: ThemeColors): void {
    // Apply theme to editor if needed
  }

  writeValue(value: string): void {
    this.content = value || '';
    if (this.editor && this.content !== this.editor.getHTML()) {
      this.editor.commands.setContent(this.content);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    // Handle disabled state if needed
  }

  ngAfterViewInit(): void {
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
      ],
      editorProps: {
        attributes: {
          class: 'prosemirror-editor forum-editor',
        },
      },
      content: this.content,
    });

    // Listen for content changes
    this.editor.on('update', () => {
      if (this.editor) {
        const newContent = this.editor.getHTML();
        if (this.content !== newContent) {
          this.content = this.sanitize(newContent);
          this.onChange(this.content);
        }
      }
    });

    // Set preselected values
    if (this.preselectedTopicId) {
      this.selectedTopicId = this.preselectedTopicId;
    }
    if (this.preselectedThreadId) {
      this.selectedThreadId = this.preselectedThreadId;
    }
  }

  override ngOnDestroy(): void {
    this.editor?.destroy();
  }

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'
      ],
      ALLOWED_ATTR: ['href', 'target', 'class'],
    });
  }

  onTopicChange(topicId: string): void {
    this.selectedTopicId = topicId;
    this.showNewTopicInput = topicId === 'new';
    
    // Filter threads for selected topic
    if (topicId && topicId !== 'new') {
      this.availableThreads = this.availableThreads.filter(t => t.topicId === topicId);
    }
    
    // Reset thread selection
    this.selectedThreadId = '';
    this.showNewThreadInput = false;
  }

  onThreadChange(threadId: string): void {
    this.selectedThreadId = threadId;
    this.showNewThreadInput = threadId === 'new';
  }

  addTag(): void {
    if (this.newTag.trim() && !this.tags.includes(this.newTag.trim())) {
      this.tags.push(this.newTag.trim());
      this.newTag = '';
    }
  }

  removeTag(index: number): void {
    this.tags.splice(index, 1);
  }

  onToolbarComponentsClick(): void {
    // Components not available in forum posts for now
    console.log('Component insertion not available in forum posts');
  }

  onToolbarImageUploadClick(): void {
    const fileInput = document.getElementById('forumImageInput') as HTMLInputElement;
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
    const reader = new FileReader();

    reader.onload = () => {
      const base64Src = reader.result as string;
      if (base64Src && this.editor) {
        this.editor.chain().focus().setImage({ src: base64Src }).run();
      }
    };

    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (!this.content.trim()) {
      return;
    }

    const postData: ForumPostData = {
      content: this.content,
      tags: this.tags,
    };

    // Handle topic creation or selection
    if (this.showNewTopicInput && this.newTopicName.trim()) {
      postData.newTopicName = this.newTopicName.trim();
      this.topicCreated.emit(this.newTopicName.trim());
    } else if (this.selectedTopicId) {
      postData.topicId = this.selectedTopicId;
    }

    // Handle thread creation or selection
    if (this.showNewThreadInput && this.newThreadTitle.trim()) {
      postData.newThreadTitle = this.newThreadTitle.trim();
      if (postData.topicId || postData.newTopicName) {
        this.threadCreated.emit({
          title: this.newThreadTitle.trim(),
          topicId: postData.topicId || '', // Will be set after topic creation
        });
      }
    } else if (this.selectedThreadId) {
      postData.threadId = this.selectedThreadId;
    }

    this.postSubmitted.emit(postData);
    this.resetForm();
  }

  private resetForm(): void {
    this.content = '';
    this.selectedTopicId = '';
    this.selectedThreadId = '';
    this.newTopicName = '';
    this.newThreadTitle = '';
    this.tags = [];
    this.newTag = '';
    this.showNewTopicInput = false;
    this.showNewThreadInput = false;
    
    if (this.editor) {
      this.editor.commands.setContent('');
    }
  }
}
