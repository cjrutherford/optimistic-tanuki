import { Component, EventEmitter, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
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
  imports: [MatIconModule, ButtonComponent, CardComponent],
  template: `
    <div class="modal-backdrop" (click)="onClose()"></div>
    <otui-card class="section-selector">
      <div class="selector-header">
        <h3>Add Section</h3>
        <button (click)="onClose()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="section-types-grid">
        @for (sectionType of sectionTypes; track sectionType.type) {
          <div
            class="section-type-item"
            (click)="selectSectionType(sectionType.type)"
            (keyup.enter)="selectSectionType(sectionType.type)"
            tabindex="0"
          >
            <div class="section-type-icon">
              <mat-icon>{{ sectionType.icon }}</mat-icon>
            </div>
            <div class="section-type-info">
              <h4>{{ sectionType.name }}</h4>
              <p>{{ sectionType.description }}</p>
            </div>
          </div>
        }
      </div>

      <div class="selector-actions">
        <otui-button variant="secondary" (action)="onClose()">Cancel</otui-button>
      </div>
    </otui-card>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
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
      color: var(--foreground-secondary, #666);
      display: flex;
      align-items: center;
    }

    .close-btn:hover {
      background-color: var(--accent-light, #f0f0f0);
      color: var(--accent, #007acc);
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
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1rem;
      border: 2px solid var(--border-color, #e0e0e0);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      background: var(--background, white);
    }

    .section-type-item:hover {
      border-color: var(--accent, #007acc);
      background: var(--accent-light, #f0f8ff);
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }

    .section-type-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: var(--accent-light, #f0f0f0);
      border-radius: 8px;
      color: var(--accent, #007acc);
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
      color: var(--foreground-secondary, #666);
      line-height: 1.4;
    }

    .selector-actions {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border-color, #e0e0e0);
      display: flex;
      justify-content: flex-end;
    }
  `],
})
export class SectionSelectorComponent {
  @Output() sectionTypeSelected = new EventEmitter<SectionType>();
  @Output() closed = new EventEmitter<void>();

  sectionTypes: SectionTypeOption[] = [
    {
      type: 'hero',
      name: 'Hero Section',
      description: 'Eye-catching banner with title, subtitle, and call-to-action',
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

  onClose(): void {
    this.closed.emit();
  }
}
