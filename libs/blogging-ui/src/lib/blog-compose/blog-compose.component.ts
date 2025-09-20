import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { QuillEditorComponent, QuillModule } from 'ngx-quill';
import Quill from 'quill';
import MagicUrl from 'quill-magic-url';
import ImageCompress from 'quill-image-compress';
import Cursors from 'quill-cursors';
import Placeholder from 'quill-placeholder-module';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
import { GradientBuilder } from 'libs/common-ui/src/lib/common-ui/gradient-builder';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

// Register Quill modules
Quill.register('modules/imageCompress', ImageCompress);
Quill.register('modules/cursors', Cursors);
Quill.register('modules/placeholder', Placeholder);
Quill.register('modules/magicUrl', MagicUrl);

// Builder for Quill modules
class QuillModulesBuilder {
  private modules: { [key: string]: any } = {};

  constructor() {
    this.modules['toolbar'] = [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ header: 1 }, { header: 2 }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ script: 'sub' }, { script: 'super' }],
      [{ indent: '-1' }, { indent: '+1' }],
      [{ direction: 'rtl' }],
      [{ size: ['small', false, 'large', 'huge'] }],
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      [{ color: [] }, { background: [] }],
      [{ font: [] }],
      [{ align: [] }],
      ['link', 'image', 'video', 'formula'],
      ['clean'],
    ];
  }

  withModule(name: string, config: any): this {
    this.modules[name] = config;
    return this;
  }

  build(): { [key: string]: any } {
    return this.modules;
  }
}

@Component({
  selector: 'lib-blog-compose',
  imports: [
    CommonModule,
    FormsModule,
    QuillEditorComponent,
    CardComponent,
    TextInputComponent,
    ButtonComponent,
    QuillModule,
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
})
export class BlogComposeComponent extends Themeable {
  @ViewChild('quillEditor', { static: true }) quillEditor!: QuillEditorComponent;
  @Output() postSubmitted: EventEmitter<any> = new EventEmitter<any>();
  @Output() attachmentAdded = new EventEmitter<{ placeholderId: string; file: File }>();

  backgroundGradient = 'linear-gradient(to right, #5969c3, #59c360)';
  isDragOver = false;
  title = '';
  content = '';
  links: Array<{ url: string }> = [];
  attachments: any[] = [];
  quillModules = new QuillModulesBuilder()
    .withModule('magicUrl', true)
    .withModule('imageCompress', { quality: 0.7, maxWidth: 800, maxHeight: 600 })
    .build();

  onContentChange(event: any) {
    this.content = event.html;
  }

  handleDragEnter(e: Event): void {
    console.log('Drag Enter', e);
    e.preventDefault();
    this.isDragOver = true;
  }

  handleDragOver(e: Event): void {
    console.log('Drag Over', e);
    e.preventDefault();
    this.isDragOver = true;
  }

  handleDragLeave(e: Event): void {
    console.log('Drag Leave', e);
    e.preventDefault();
    this.isDragOver = false;
  }

  handleDrop(e: DragEvent): void {
    console.log('Drop', e);
    e.preventDefault();
    this.isDragOver = false;

    if (!e.dataTransfer?.files.length) return;

    const files = Array.from(e.dataTransfer.files);
    files.forEach((file) => {
      const placeholderId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      this.attachmentAdded.emit({ placeholderId, file });

      const reader = new FileReader();
      reader.onload = (event: ProgressEvent<FileReader>) => {
        const base64Src = event.target?.result as string;
        if (base64Src) {
          const mediaType = file.type.startsWith('image') ? 'image' : 'video';
          this.quillEditor.quillEditor.insertEmbed(
            this.quillEditor.quillEditor.getLength(),
            mediaType,
            base64Src,
            Quill.sources.USER
          );
          this.content = this.quillEditor.quillEditor.root.innerHTML;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  ngAfterViewInit(): void {
    console.log('QuillEditor initialized:', this.quillEditor);
  }

  onPostSubmit() {
    this.postSubmitted.emit({
      title: this.title,
      content: this.content,
      links: this.links,
      attachments: this.attachments,
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