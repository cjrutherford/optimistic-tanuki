import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
} from '@angular/core';
import { ButtonComponent } from '@optimistic-tanuki/common-ui/button/button.component';
import { CardComponent } from '@optimistic-tanuki/common-ui/card/card.component';
import { IconComponent } from '@optimistic-tanuki/common-ui/icon/icon.component';
import { SectionType } from '@optimistic-tanuki/app-config-models';

interface SectionTypeOption {
  type: SectionType;
  name: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-section-selector',
  standalone: true,
  imports: [IconComponent, ButtonComponent, CardComponent],
  template: `
    <div class="modal-backdrop" (click)="onClose()"></div>
    <otui-card
      #dialog
      class="section-selector"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-selector-title"
      tabindex="-1"
    >
      <div class="selector-header">
        <h3 id="section-selector-title">Add Section</h3>
        <button
          type="button"
          (click)="onClose()"
          class="close-btn"
          aria-label="Close section selector"
        >
          <otui-icon name="close"></otui-icon>
        </button>
      </div>

      <div class="section-types-grid">
        @for (sectionType of sectionTypes; track sectionType.type) {
        <button
          type="button"
          class="section-type-item"
          (click)="selectSectionType(sectionType.type)"
        >
          <div class="section-type-icon">
            <otui-icon [name]="sectionType.icon"></otui-icon>
          </div>
          <div class="section-type-info">
            <h4>{{ sectionType.name }}</h4>
            <p>{{ sectionType.description }}</p>
          </div>
        </button>
        }
      </div>

      <div class="selector-actions">
        <otui-button variant="secondary" (action)="onClose()"
          >Cancel</otui-button
        >
      </div>
    </otui-card>
  `,
  styles: [
    `
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: color-mix(
          in srgb,
          var(--foreground, #111827) 36%,
          transparent
        );
        z-index: 999;
      }

      .section-selector {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-height: 80vh;
        z-index: 1000;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      @media (max-width: 680px) {
        .section-selector {
          width: calc(100vw - 2rem);
          max-height: calc(100vh - 2rem);
        }

        .section-types-grid {
          grid-template-columns: 1fr;
          padding: 1rem;
        }

        .selector-header,
        .selector-actions {
          padding-inline: 1rem;
        }
      }

      .selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .selector-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 500;
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.5rem;
        border-radius: 4px;
        color: color-mix(in srgb, var(--foreground, #111827) 68%, transparent);
        display: flex;
        align-items: center;
      }

      .close-btn:hover {
        background-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 10%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
      }

      .section-types-grid {
        flex: 1;
        padding: 1.5rem;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 1rem;
      }

      .section-type-item {
        width: 100%;
        text-align: left;
        font: inherit;
        color: inherit;
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
        border: 2px solid var(--border-color, #e0e0e0);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
      }

      .section-type-item:hover {
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 56%,
          transparent
        );
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 12%,
          var(--surface, #ffffff)
        );
        transform: translateY(-2px);
        box-shadow: 0 4px 8px
          color-mix(in srgb, var(--foreground, #111827) 10%, transparent);
      }

      .section-type-item:focus-visible,
      .close-btn:focus-visible {
        outline: 3px solid color-mix(in srgb, var(--accent, #2563eb) 72%, white);
        outline-offset: 2px;
      }

      .section-type-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        background: color-mix(
          in srgb,
          var(--accent, #2563eb) 10%,
          var(--surface, #ffffff)
        );
        border-radius: 8px;
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
        flex-shrink: 0;
      }

      .section-type-icon mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }

      .section-type-info {
        flex: 1;
      }

      .section-type-info h4 {
        margin: 0 0 0.25rem 0;
        font-size: 1rem;
        font-weight: 500;
      }

      .section-type-info p {
        margin: 0;
        font-size: 0.875rem;
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
        line-height: 1.4;
      }

      .selector-actions {
        padding: 1rem 1.5rem;
        border-top: 1px solid var(--border-color, #e0e0e0);
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class SectionSelectorComponent implements AfterViewInit {
  @Output() sectionTypeSelected = new EventEmitter<SectionType>();
  @Output() closed = new EventEmitter<void>();
  @ViewChild('dialog', { read: ElementRef })
  private dialog?: ElementRef<HTMLElement>;
  private returnFocusElement: HTMLElement | null = null;

  sectionTypes: SectionTypeOption[] = [
    {
      type: 'hero',
      name: 'Hero Section',
      description:
        'Eye-catching banner with title, subtitle, and call-to-action',
      icon: 'landscape',
    },
    {
      type: 'features',
      name: 'Features Section',
      description: 'Showcase key features with icons and descriptions',
      icon: 'stars',
    },
    {
      type: 'content',
      name: 'Content Section',
      description: 'Rich content area with text and optional image',
      icon: 'article',
    },
    {
      type: 'grid',
      name: 'Grid Section',
      description: 'Display items in a responsive grid layout',
      icon: 'grid_view',
    },
    {
      type: 'cta',
      name: 'Call to Action',
      description: 'Prominent button to drive user actions',
      icon: 'campaign',
    },
    {
      type: 'footer',
      name: 'Footer Section',
      description: 'Bottom section with links and information',
      icon: 'footer',
    },
  ];

  selectSectionType(type: SectionType): void {
    this.sectionTypeSelected.emit(type);
  }

  ngAfterViewInit(): void {
    this.returnFocusElement = document.activeElement as HTMLElement | null;
    this.dialog?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
    this.returnFocusElement?.focus();
  }
}
