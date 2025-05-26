import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CreatePostDto, UpdatePostDto, CreateAttachmentDto, AttachmentDto } from '../../models';
import { QuillEditorComponent, QuillModule, QuillModules } from 'ngx-quill';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import Quill from 'quill';
import MagicUrl from 'quill-magic-url';
import ImageCompress from 'quill-image-compress';
import Cursors from 'quill-cursors';
import Placeholder from 'quill-placeholder-module';

Quill.register('modules/imageCompress', ImageCompress);
Quill.register('modules/cursors', Cursors);
Quill.register('modules/placeholder', Placeholder);
Quill.register('modules/magicUrl', MagicUrl);

export declare type ComposeCompleteEvent = {
  post: CreatePostDto | UpdatePostDto;
  attachments: CreateAttachmentDto[];
  links: { url: string }[];
};

@Component({
  selector: 'lib-compose',
  standalone: true,
  imports: [
    FormsModule,
    CommonModule,
    CardComponent,
    ButtonComponent,
    ReactiveFormsModule,
    QuillEditorComponent,
    TextInputComponent,
    QuillModule,
  ],
  templateUrl: './compose.component.html',
  styleUrls: ['./compose.component.scss'],
  // encapsulation: ViewEncapsulation.Emulated,
})
export class ComposeComponent { 
  @ViewChild('quillEditor', { static: true }) quillEditor!: QuillEditorComponent;
  @Output() postSubmitted: EventEmitter<ComposeCompleteEvent> = new EventEmitter<ComposeCompleteEvent>();

  isDragOver = false;
  // themeService = inject(ThemeService); // Removed
  title = '';
  content = ''
  links: Array<{ url: string }> = [];
  attachments: AttachmentDto[] = [];
  // sub!: Subscription; // Removed


  modules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      ['table'],
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
      ['code-block'],
    ],
    syntax: true,
    clipboard: {
      matchVisual: false,
    },
    history: {
      delay: 1000,
      maxStack: 500,
      userOnly: true,
    },
    magicUrl: true,
    imageCompress: {
      quality: 0.7,
      maxWidth: 800,
      maxHeight: 600,
      imageType: 'image/jpeg',
      debug: false,
      handle: {
        click: true,
        dblclick: true,
        contextmenu: true,
      },
      resize: {
        handle: {
          click: true,
          dblclick: true,
          contextmenu: true,
        },
        minWidth: 50,
        minHeight: 50,
        maxWidth: 1000,
        maxHeight: 1000,
        step: 5,
        resize: true,
      },
    },
    table: {
      handle: {
        click: true,
        dblclick: true,
        contextmenu: true,
      },
      resize: {
        handle: {
          click: true,
          dblclick: true,
          contextmenu: true,
        },
        minWidth: 50,
        minHeight: 50,
        maxWidth: 1000,
        maxHeight: 1000,
        step: 5,
        resize: true,
        resizeHandle: true,
        resizeHandleClass: 'ql-table-resize-handle',
        resizeHandleStyle: {
          backgroundColor: '#000',
          border: '1px solid #fff',
          borderRadius: '50%',
          width: '10px',
          height: '10px',
          cursor: 'nwse-resize',
          position: 'absolute',
          zIndex: 1000,
          top: '-5px',
          left: '-5px',
          transform: 'translate(-50%, -50%)',
        },
      },
    },
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    const files = event.dataTransfer?.files;
    if (files) {
      const fileArray = Array.from(files);
      fileArray.forEach((file) => {
        const reader = new FileReader();
         
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        reader.onload = (e: any) => {
          const quill = this.quillEditor?.quillEditor as Quill;
          if (file.type.startsWith('image/')) {
            quill.insertEmbed(
              quill.getSelection()?.index || 0,
              'image',
              e.target.result,
            );
          } else if (file.type.startsWith('video/')) {
            quill.insertEmbed(
              quill.getSelection()?.index || 0,
              'video',
              e.target.result,
            );
          } else {
            const link = `<a href="${e.target.result}" target="_blank">${file.name}</a>`;
            quill.clipboard.dangerouslyPasteHTML(
              quill.getSelection()?.index || 0,
              link,
            );
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }
  parseImages(doc: Document): CreateAttachmentDto[] {
    const images = doc.querySelectorAll('img');
    const attachments: CreateAttachmentDto[] = [];
    images.forEach((image) => {
      const src = image.getAttribute('src');
      if (src) {
        attachments.push({ url: src, postId: '' });
      }
    });
    return attachments;
  }

  parseVideos(doc: Document): CreateAttachmentDto[] {
    const videos = doc.querySelectorAll('video');
    const attachments: CreateAttachmentDto[] = [];
    videos.forEach((video) => {
      const src = video.getAttribute('src');
      if (src) {
        attachments.push({ url: src, postId: '' });
      }
    });
    return attachments;
  }

  parseAttachments(doc: Document): CreateAttachmentDto[] {
    const attachments: CreateAttachmentDto[] = [];
    const otherAttachments = doc.querySelectorAll('[data-attachment]');
    otherAttachments.forEach((attachment) => {
      const url = attachment.getAttribute('data-attachment');
      if (url) {
      attachments.push({ url, postId: '' });
      }
    });
    return attachments;
  }


  onSubmit(): void {
    const post: CreatePostDto = {
      title: this.title,
      content: this.content,
      attachments: [],
      profileId: '',
    };
    const attachments: CreateAttachmentDto[] = this.attachments.map((attachment) => ({
      url: attachment.url,
      postId: '',
    }));
    const links = this.links.map((link) => ({ url: link.url }));
    this.postSubmitted.emit({ post, attachments, links });
    this.title = '';
    this.content = '';
    this.attachments = [];
    this.links = [];
  }

  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  onContentChange(event: any) {
    console.log('Content changed:', event);
    const doc = new DOMParser().parseFromString(event.html, 'text/html');
    const images = doc.querySelectorAll('img');
    const imageSources = [];
    images.forEach((image: HTMLElement) => {
      const src = image.getAttribute('src');
      if (src) {
        imageSources.push(src);
      }
    });
    this.content = event.html;
    console.log('Content changed:', this.content);
  }

  onPostSubmit(): void {
    console.log(this.content);
    this.onSubmit();
  }
}
