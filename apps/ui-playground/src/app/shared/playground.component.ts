import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeEditorComponent } from './code-editor.component';

@Component({
  selector: 'pg-playground',
  standalone: true,
  imports: [CommonModule, FormsModule, CodeEditorComponent],
  template: `
    <div class="playground">
      <div class="playground-header">
        <span class="playground-title">{{ title }}</span>
        <div class="playground-tabs">
          <button
            [class.active]="activeTab === 'preview'"
            (click)="activeTab = 'preview'"
          >
            Preview
          </button>
          <button
            [class.active]="activeTab === 'code'"
            (click)="activeTab = 'code'"
          >
            Code
          </button>
        </div>
      </div>

      @if (activeTab === 'preview') {
      <div class="playground-preview">
        <div class="preview-stage">
          <ng-content></ng-content>
        </div>
      </div>
      } @else {
      <div class="playground-code">
        <textarea
          class="code-input"
          [(ngModel)]="editableCode"
          (input)="onCodeChange()"
          spellcheck="false"
          placeholder="Write your code here..."
        ></textarea>
        <div class="code-output">
          <pg-code-editor [code]="displayCode" [language]="language" />
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .playground {
        border: 1px solid rgba(129, 168, 222, 0.14);
        border-radius: 1rem;
        background: rgba(8, 13, 22, 0.56);
        overflow: hidden;
      }

      .playground-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.65rem 1rem;
        border-bottom: 1px solid rgba(129, 168, 222, 0.1);
        background: rgba(12, 20, 35, 0.8);
      }

      .playground-title {
        font-family: var(--font-heading);
        font-size: 0.95rem;
        color: var(--foreground);
      }

      .playground-tabs {
        display: flex;
        gap: 0.25rem;
      }

      .playground-tabs button {
        padding: 0.4rem 0.85rem;
        border: none;
        border-radius: 0.5rem;
        background: transparent;
        color: var(--muted);
        font-size: 0.8rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .playground-tabs button.active {
        background: rgba(59, 130, 246, 0.15);
        color: var(--primary);
      }

      .playground-preview {
        padding: 1.5rem;
      }

      .preview-stage {
        min-height: 150px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .playground-code {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: rgba(129, 168, 222, 0.1);
      }

      .code-input {
        padding: 1rem;
        border: none;
        background: rgba(5, 10, 18, 0.95);
        color: #d9ebff;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 0.8rem;
        line-height: 1.5;
        resize: vertical;
        min-height: 200px;
      }

      .code-input:focus {
        outline: none;
      }

      .code-output {
        background: rgba(5, 10, 18, 0.95);
        padding: 1rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaygroundComponent {
  @Input() title = 'Interactive Playground';
  @Input() initialCode = '';
  @Input() language = 'typescript';

  activeTab: 'preview' | 'code' = 'preview';
  editableCode = '';
  displayCode = '';

  ngOnInit() {
    this.editableCode = this.initialCode;
    this.displayCode = this.initialCode;
  }

  onCodeChange() {
    this.displayCode = this.editableCode;
  }
}
