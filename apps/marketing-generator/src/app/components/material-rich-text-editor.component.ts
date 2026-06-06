import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TiptapEditorDirective } from 'ngx-tiptap';

@Component({
  selector: 'app-material-rich-text-editor',
  standalone: true,
  imports: [CommonModule, TiptapEditorDirective],
  template: `
    <div class="rich-editor-shell">
      <div class="toolbar">
        <button type="button" (click)="toggleBold()">Bold</button>
        <button type="button" (click)="toggleItalic()">Italic</button>
        <button type="button" (click)="setParagraph()">Paragraph</button>
      </div>

      <div
        *ngIf="editor"
        class="rich-editor"
        data-testid="tiptap-editor"
        [editor]="editor"
        tiptapEditor
        outputFormat="html"
        (focusout)="handleBlur()"
      ></div>

      <div
        *ngIf="!editor"
        class="rich-editor rich-editor-fallback"
        data-testid="tiptap-editor"
      >
        Rich editor unavailable during server rendering.
      </div>
    </div>
  `,
  styles: [
    `
      .rich-editor-shell {
        display: grid;
        gap: 0.75rem;
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .toolbar button {
        padding: 0.55rem 0.85rem;
        border-radius: 999px;
        border: 1px solid
          color-mix(
            in srgb,
            var(--border, rgba(255, 255, 255, 0.12)) 90%,
            transparent
          );
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 86%,
          transparent
        );
        color: var(--foreground, #f7f1e6);
      }

      .rich-editor {
        min-height: 8rem;
        border-radius: var(--border-radius-md, 14px);
        border: 1px solid
          color-mix(
            in srgb,
            var(--border, rgba(255, 255, 255, 0.12)) 90%,
            transparent
          );
        padding: 0.9rem 1rem;
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 82%,
          transparent
        );
      }

      :host ::ng-deep .rich-editor .ProseMirror {
        min-height: 6rem;
        outline: none;
        color: var(--foreground, #f7f1e6);
      }

      :host ::ng-deep .rich-editor .ProseMirror p {
        margin: 0 0 0.75rem;
      }
    `,
  ],
})
export class MaterialRichTextEditorComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly content = input<string>('');
  readonly contentChange = output<string>();
  readonly editorBlur = output<void>();

  readonly editor = isPlatformBrowser(this.platformId)
    ? new Editor({
        extensions: [StarterKit],
        content: this.content() || '<p></p>',
        onUpdate: ({ editor }) => {
          this.contentChange.emit(editor.getHTML());
        },
      })
    : null;

  constructor() {
    effect(() => {
      if (!this.editor) {
        return;
      }

      const nextContent = this.content() || '<p></p>';
      if (nextContent !== this.editor.getHTML()) {
        this.editor.commands.setContent(nextContent, { emitUpdate: false });
      }
    });
  }

  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  setParagraph(): void {
    this.editor?.chain().focus().setParagraph().run();
  }

  handleBlur(): void {
    this.editorBlur.emit();
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}
