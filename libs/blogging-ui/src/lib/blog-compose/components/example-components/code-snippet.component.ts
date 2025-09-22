import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-code-snippet',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  template: `
    <otui-card class="code-snippet">
      <div class="code-header" *ngIf="title || language">
        <span class="code-title" *ngIf="title">{{ title }}</span>
        <span class="code-language" *ngIf="language">{{ language }}</span>
        <otui-button variant="secondary" size="small" (action)="copyCode()">
          Copy
        </otui-button>
      </div>
      <pre class="code-content"><code [ngClass]="'language-' + language">{{ code }}</code></pre>
    </otui-card>
  `,
  styles: [`
    .code-snippet {
      margin: 1rem 0;
      overflow: hidden;
    }
    
    .code-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1rem;
      background-color: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    
    .code-title {
      font-weight: bold;
      font-size: 0.9rem;
    }
    
    .code-language {
      font-size: 0.8rem;
      color: #6c757d;
      text-transform: uppercase;
    }
    
    .code-content {
      margin: 0;
      padding: 1rem;
      background-color: #f8f9fa;
      overflow-x: auto;
      font-family: 'Courier New', monospace;
      font-size: 0.9rem;
      line-height: 1.4;
    }
    
    .code-content code {
      background: none;
      padding: 0;
      font-size: inherit;
      color: inherit;
    }
  `]
})
export class CodeSnippetComponent {
  @Input() title = '';
  @Input() language = 'javascript';
  @Input() code = 'console.log("Hello, World!");';
  
  async copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.code);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  }
}