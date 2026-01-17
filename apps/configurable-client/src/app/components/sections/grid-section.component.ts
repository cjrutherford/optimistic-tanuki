import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridSection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-grid-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="grid-section">
      @if (section.title) {
        <h2>{{ section.title }}</h2>
      }
      <div class="grid-container" [style.grid-template-columns]="'repeat(auto-fit, minmax(250px, 1fr))'">
        @for (item of section.items; track item.title) {
          <div class="grid-item">
            @if (item.imageUrl) {
              <img [src]="item.imageUrl" [alt]="item.title" />
            }
            <h3>{{ item.title }}</h3>
            @if (item.description) {
              <p>{{ item.description }}</p>
            }
            @if (item.link) {
              <a [href]="item.link">Learn more →</a>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .grid-section {
      padding: 4rem 2rem;
    }
    .grid-container {
      display: grid;
      gap: 2rem;
      max-width: 1200px;
      margin: 2rem auto 0;
    }
    .grid-item {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
    }
    .grid-item img {
      width: 100%;
      border-radius: 4px;
      margin-bottom: 1rem;
    }
  `],
})
export class GridSectionComponent {
  @Input() section!: GridSection;
}
