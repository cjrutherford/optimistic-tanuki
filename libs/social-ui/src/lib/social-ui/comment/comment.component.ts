import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  TemplateRef,
  ViewChild,
  inject,
  AfterViewInit,
  OnDestroy,
  Input,
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TiptapEditorDirective } from 'ngx-tiptap';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import DOMPurify from 'dompurify';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { RichTextToolbarComponent } from '../compose/components/rich-text-toolbar.component';
import { ImageUploadCallback } from '..';
import { ImageUploadService } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'lib-comment',
  standalone: true,
  imports: [
    FormsModule,
    CardComponent,
    ButtonComponent,
    TiptapEditorDirective,
    RichTextToolbarComponent,
  ],
  providers: [],
  templateUrl: './comment.component.html',
  styleUrl: './comment.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--accent-shade]': 'accentShade',
  },
})
export class CommentComponent
  extends Themeable
  implements OnInit, AfterViewInit, OnDestroy
{
  @Output() commentAdded: EventEmitter<string> = new EventEmitter<string>();
  @Input() imageUploadCallback?: ImageUploadCallback;
  @Input() profileId?: string; // Profile ID for asset uploads
  @ViewChild('commentDialog') commentDialog!: TemplateRef<HTMLElement>;
  comment = '';
  accentShade!: string;
  editor: Editor | null = null;

  private dialog = inject(MatDialog);
  private imageUploadService = inject(ImageUploadService);

  constructor() {
    super();
  }

  ngAfterViewInit(): void {
    this.editor = new Editor({
      extensions: [
        StarterKit,
        Image,
        Subscript,
        Superscript,
        TextAlign.configure({
          types: ['heading', 'paragraph'],
        }),
      ],
      editorProps: {
        attributes: {
          class: 'prosemirror-editor',
        },
      },
      content: this.comment,
    });

    // Listen for content changes
    this.editor.on('update', () => {
      if (this.editor) {
        const newContent = this.editor.getHTML();
        if (this.comment !== newContent) {
          this.comment = this.sanitize(newContent);
        }
      }
    });
  }

  override ngOnDestroy(): void {
    this.editor?.destroy();
  }

  private sanitize(input: string): string {
    return DOMPurify.sanitize(input);
  }

  onToolbarComponentsClick(): void {
    // Components not available in comments for now
    console.log('Component insertion not available in comments');
  }

  onToolbarImageUploadClick(): void {
    const fileInput = document.getElementById(
      'commentImageInput'
    ) as HTMLInputElement;
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

    // If custom callback is provided, use it
    if (this.imageUploadCallback) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Src = reader.result as string;
        if (base64Src) {
          try {
            const fileName = file.name || `image_${Date.now()}`;
            const assetUrl = await this.imageUploadCallback!(base64Src, fileName);
            if (this.editor) {
              this.editor.chain().focus().setImage({ src: assetUrl }).run();
            }
          } catch (error) {
            console.error('Failed to upload image:', error);
            // Fallback to base64 if upload fails
            if (this.editor) {
              this.editor.chain().focus().setImage({ src: base64Src }).run();
            }
          }
        }
      };
      reader.readAsDataURL(file);
    } else {
      // Use ImageUploadService directly
      if (!this.profileId) {
        console.error('Profile ID is required for image upload');
        alert('Unable to upload image: User profile not found');
        input.value = '';
        return;
      }

      try {
        const assetUrl = await this.imageUploadService.uploadFile(
          file,
          this.profileId,
          `comment-image-${Date.now()}`
        );

        if (this.editor) {
          this.editor.chain().focus().setImage({ src: assetUrl }).run();
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        alert('Failed to upload image. Please try again.');
      } finally {
        input.value = '';
      }
    }
  }

  override applyTheme(colors: ThemeColors) {
    this.background = `linear-gradient(30deg, ${colors.accent}, ${colors.background})`;
    this.accent = colors.accent;
    this.borderColor = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.complementaryGradients['dark'];
      this.accentShade = colors.accentShades[6][1];
    } else {
      this.borderGradient = colors.complementaryGradients['light'];
      this.accentShade = colors.accentShades[2][1];
    }
    this.foreground = colors.foreground;
    this.complement = colors.complementary;
    this.transitionDuration = '0.5s';
  }

  openCommentDialog() {
    this.dialog.closeAll();
    this.dialog.open(this.commentDialog);
  }

  onSubmit() {
    this.commentAdded.emit(this.comment);
    this.comment = '';
    if (this.editor) {
      this.editor.commands.setContent('');
    }
    this.dialog.closeAll();
  }

  onCancel() {
    this.comment = '';
    if (this.editor) {
      this.editor.commands.setContent('');
    }
    this.dialog.closeAll();
  }
}
