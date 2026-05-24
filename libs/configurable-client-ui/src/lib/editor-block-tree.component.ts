import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { BlockInstance } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-editor-block-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="block-tree" data-block-tree>
      @for (block of blocks; track block.id; let i = $index) {
      <button
        type="button"
        class="canvas-block-card"
        [class.selected]="selectedBlockId === block.id"
        (click)="blockSelected.emit(block.id)"
      >
        <span class="canvas-block-index">{{ i + 1 }}</span>
        <span class="canvas-block-copy">
          <strong>{{ getTitle(block) }}</strong>
          <small>{{ block.type }}</small>
        </span>
      </button>
      }
    </div>
  `,
})
export class EditorBlockTreeComponent {
  @Input() blocks: BlockInstance[] = [];
  @Input() selectedBlockId: string | null = null;
  @Input() fallbackTitle: (block: BlockInstance, index: number) => string = (
    block
  ) => block.type;

  @Output() blockSelected = new EventEmitter<string>();

  getTitle(block: BlockInstance): string {
    const title = block.data['title'];
    if (typeof title === 'string' && title.trim().length > 0) {
      return title;
    }

    return this.fallbackTitle(block, this.blocks.indexOf(block));
  }
}
