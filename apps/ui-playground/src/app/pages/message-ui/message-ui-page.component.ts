import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  MessageComponent,
  MessageService,
  type MessageLevelType,
} from '@optimistic-tanuki/message-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-message-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    MessageComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/message-ui"
      title="Message UI"
      description="System message stack for transient feedback, warnings, and success confirmations."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        <div class="preview-padded">
          <lib-message />
        </div>
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageUiPageComponent {
  readonly importSnippet = `import { MessageComponent } from '@optimistic-tanuki/message-ui';`;
  readonly messageService = inject(MessageService);
  configs: Record<string, ElementConfig> = {};
  readonly elements: PlaygroundElement[] = [
    {
      id: 'message',
      title: 'Message Stack',
      headline: 'Inline status feedback',
      importName: 'MessageComponent',
      selector: 'lib-message',
      summary: 'Dismissible message rail for info, warnings, errors, and success states.',
      props: [],
    },
  ];

  constructor() {
    this.configs['message'] = {};
    if (this.messageService.messages().length === 0) {
      this.seedMessage('Saved design token changes.', 'success');
      this.seedMessage('Preview data is using mock services.', 'info');
    }
  }

  private seedMessage(content: string, type: MessageLevelType): void {
    this.messageService.addMessage({ content, type });
  }
}
