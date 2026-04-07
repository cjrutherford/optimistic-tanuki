import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'pg-code-editor',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="code-editor">
      <div class="editor-header">
        <span class="editor-label">{{ language }}</span>
        <button class="copy-btn" (click)="copyCode()" [class.copied]="copied">
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
      </div>
      <div class="editor-content">
        <pre><code [class]="'language-' + language">{{ code }}</code></pre>
      </div>
    </div>
  `,
  styles: [
    `
      .code-editor {
        border: 1px solid rgba(129, 168, 222, 0.16);
        border-radius: 0.85rem;
        background: rgba(5, 10, 18, 0.9);
        overflow: hidden;
      }

      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 0.85rem;
        border-bottom: 1px solid rgba(129, 168, 222, 0.1);
        background: rgba(8, 15, 28, 0.8);
      }

      .editor-label {
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--primary);
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .copy-btn {
        padding: 0.35rem 0.75rem;
        border: 1px solid rgba(129, 168, 222, 0.2);
        border-radius: 0.4rem;
        background: rgba(59, 130, 246, 0.12);
        color: var(--primary);
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .copy-btn:hover {
        background: rgba(59, 130, 246, 0.2);
      }

      .copy-btn.copied {
        background: rgba(34, 197, 94, 0.2);
        border-color: rgba(34, 197, 94, 0.3);
        color: #22c55e;
      }

      .editor-content {
        padding: 0.85rem;
        overflow-x: auto;
      }

      pre {
        margin: 0;
      }

      code {
        font-family: 'IBM Plex Mono', 'Fira Code', monospace;
        font-size: 0.82rem;
        line-height: 1.6;
        color: #d9ebff;
      }

      .language-html .tag {
        color: #7dd3fc;
      }
      .language-html .attr {
        color: #fbbf24;
      }
      .language-html .string {
        color: #86efac;
      }
      .language-typescript .keyword {
        color: #c084fc;
      }
      .language-typescript .string {
        color: #86efac;
      }
      .language-typescript .function {
        color: #60a5fa;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CodeEditorComponent {
  @Input() code = '';
  @Input() language = 'typescript';
  copied = false;

  copyCode(): void {
    navigator.clipboard.writeText(this.code).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    });
  }
}
