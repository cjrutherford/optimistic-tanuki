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
        <span class="canvas-block-index" data-block-index>{{ i + 1 }}</span>
        <span class="canvas-block-copy">
          <strong data-block-title>{{ getTitle(block) }}</strong>
          <span class="canvas-block-meta">
            <small class="section-type-pill" data-block-type>{{
              formatTypeLabel(block.type)
            }}</small>
          </span>
        </span>
      </button>
      }
    </div>
  `,
  styles: [
    `
      .block-tree {
        display: grid;
        gap: 0.75rem;
      }

      .canvas-block-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.9rem;
        align-items: center;
        width: 100%;
        padding: 0.95rem 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid
          color-mix(in srgb, var(--border, #e2e8f0) 86%, transparent);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #ffffff)
        );
        color: var(--foreground, #111827);
        text-align: left;
        cursor: pointer;
        transition: transform 0.18s ease, border-color 0.18s ease,
          box-shadow 0.18s ease, background-color 0.18s ease;
      }

      .canvas-block-card:hover {
        transform: translateY(-1px);
        border-color: color-mix(
          in srgb,
          var(--primary, #3f51b5) 34%,
          var(--border, #e2e8f0)
        );
        background: color-mix(
          in srgb,
          var(--primary, #3f51b5) 6%,
          var(--surface, #ffffff)
        );
        box-shadow: 0 12px 28px
          color-mix(in srgb, var(--foreground, #111827) 10%, transparent);
      }

      .canvas-block-card:focus-visible {
        outline: 2px solid
          color-mix(in srgb, var(--primary, #3f51b5) 72%, transparent);
        outline-offset: 3px;
      }

      .canvas-block-card.selected {
        border-color: color-mix(
          in srgb,
          var(--primary, #3f51b5) 46%,
          var(--border, #e2e8f0)
        );
        background: color-mix(
          in srgb,
          var(--primary, #3f51b5) 10%,
          var(--surface, #ffffff)
        );
        box-shadow: 0 0 0 1px
            color-mix(in srgb, var(--primary, #3f51b5) 28%, transparent),
          0 16px 34px
            color-mix(in srgb, var(--foreground, #111827) 10%, transparent);
      }

      .canvas-block-index {
        display: inline-grid;
        place-items: center;
        width: 2.15rem;
        height: 2.15rem;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--foreground, #111827) 92%,
          var(--background, #ffffff)
        );
        color: var(--background, #ffffff);
        font-size: 0.82rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--foreground, #111827) 14%, transparent);
      }

      .canvas-block-card.selected .canvas-block-index {
        background: var(--primary, #3f51b5);
        color: var(--primary-foreground, #ffffff);
      }

      .canvas-block-copy {
        display: grid;
        gap: 0.32rem;
        min-width: 0;
      }

      .canvas-block-copy strong {
        font-size: 0.96rem;
        font-weight: 700;
        line-height: 1.25;
        color: var(--foreground, #111827);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .canvas-block-meta {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        min-width: 0;
      }

      .section-type-pill {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        padding: 0.24rem 0.56rem;
        border-radius: 999px;
        border: 1px solid
          color-mix(
            in srgb,
            var(--primary, #3f51b5) 18%,
            var(--border, #e2e8f0)
          );
        background: color-mix(in srgb, var(--primary, #3f51b5) 8%, transparent);
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
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

  formatTypeLabel(type: string): string {
    return type.replace(/[-_]+/g, ' ');
  }
}
