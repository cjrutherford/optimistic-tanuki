import { Component, EventEmitter, Input, Output } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { InjectableComponent } from '../interfaces/component-injection.interface';

@Component({
  selector: 'lib-component-selector',
  standalone: true,
  imports: [MatIconModule, ButtonComponent, CardComponent],
  template: `
    @if (isVisible) {
      <otui-card class="component-selector">
        <div class="selector-header">
          <h3>Insert Component</h3>
          <button (click)="onClose()" class="close-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        @if (categories.length > 1) {
          <div class="component-categories">
            @for (category of categories; track category) {
              <button
                [class.active]="selectedCategory === category"
                (click)="selectCategory(category)"
                class="category-btn"
                >
                {{ category }}
              </button>
            }
          </div>
        }
        <div class="component-grid">
          @for (component of filteredComponents; track component) {
            <div
              class="component-item"
              (click)="selectComponent(component)"
              >
              <div class="component-icon">
                @if (component.icon) {
                  <mat-icon>{{ component.icon }}</mat-icon>
                } @else {
                  <mat-icon>extension</mat-icon>
                }
              </div>
              <div class="component-info">
                <h4>{{ component.name }}</h4>
                @if (component.description) {
                  <p>{{ component.description }}</p>
                }
              </div>
            </div>
          }
        </div>
        <div class="selector-actions">
          <otui-button variant="secondary" (action)="onClose()">Cancel</otui-button>
        </div>
      </otui-card>
    }
    `,
  styles: [`
    .component-selector {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 400px;
      max-height: 500px;
      z-index: 1000;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    
    .selector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
    }
    
    .selector-header h3 {
      margin: 0;
      font-size: 1.2rem;
    }
    
    .close-btn {
      background: none;
      border: none;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 4px;
    }
    
    .close-btn:hover {
      background-color: var(--accent, #f0f0f0);
    }
    
    .component-categories {
      display: flex;
      gap: 0.5rem;
      padding: 1rem;
      border-bottom: 1px solid var(--border-color, #e0e0e0);
      flex-wrap: wrap;
    }
    
    .category-btn {
      padding: 0.5rem 1rem;
      border: 1px solid var(--border-color, #e0e0e0);
      background: var(--background, white);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .category-btn:hover {
      background-color: var(--accent, #f0f0f0);
    }
    
    .category-btn.active {
      background-color: var(--accent, #007acc);
      color: white;
      border-color: var(--accent, #007acc);
    }
    
    .component-grid {
      flex: 1;
      padding: 1rem;
      overflow-y: auto;
      max-height: 300px;
    }
    
    .component-item {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem;
      border: 1px solid var(--border-color, #e0e0e0);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 0.5rem;
    }
    
    .component-item:hover {
      background-color: var(--accent, #f0f0f0);
      border-color: var(--accent, #007acc);
    }
    
    .component-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background-color: var(--accent, #f0f0f0);
      border-radius: 4px;
    }
    
    .component-info {
      flex: 1;
    }
    
    .component-info h4 {
      margin: 0 0 0.25rem 0;
      font-size: 1rem;
    }
    
    .component-info p {
      margin: 0;
      font-size: 0.875rem;
      color: var(--foreground-secondary, #666);
    }
    
    .selector-actions {
      padding: 1rem;
      border-top: 1px solid var(--border-color, #e0e0e0);
      display: flex;
      justify-content: flex-end;
    }
  `]
})
export class ComponentSelectorComponent {
  @Input() isVisible = false;
  @Input() components: InjectableComponent[] = [];
  @Output() componentSelected = new EventEmitter<InjectableComponent>();
  @Output() closed = new EventEmitter<void>();

  selectedCategory = 'All';
  
  get categories(): string[] {
    const categorySet = new Set(['All']);
    this.components.forEach(component => {
      if (component.category) {
        categorySet.add(component.category);
      }
    });
    return Array.from(categorySet);
  }
  
  get filteredComponents(): InjectableComponent[] {
    if (this.selectedCategory === 'All') {
      return this.components;
    }
    return this.components.filter(component => component.category === this.selectedCategory);
  }
  
  selectCategory(category: string): void {
    this.selectedCategory = category;
  }
  
  selectComponent(component: InjectableComponent): void {
    this.componentSelected.emit(component);
  }
  
  onClose(): void {
    this.closed.emit();
  }
}