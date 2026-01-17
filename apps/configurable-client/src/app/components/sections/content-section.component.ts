import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContentSection } from '@optimistic-tanuki/app-config-models';

@Component({
  selector: 'app-content-section',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="content-section" [ngClass]="'image-' + (section.imagePosition || 'right')">
      <div class="content-wrapper">
        @if (section.imageUrl) {
          <div class="content-image">
            <img [src]="section.imageUrl" [alt]="section.title || 'Content image'" />
          </div>
        }
        <div class="content-text">
          @if (section.title) {
            <h2>{{ section.title }}</h2>
          }
          <div [innerHTML]="section.content"></div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .content-section {
      padding: 4rem 2rem;
    }
    .content-wrapper {
      display: grid;
      gap: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      align-items: center;
    }
    .image-left .content-wrapper {
      grid-template-columns: 1fr 1fr;
    }
    .image-right .content-wrapper {
      grid-template-columns: 1fr 1fr;
    }
    .image-right .content-image {
      order: 2;
    }
    .content-image img {
      width: 100%;
      border-radius: 8px;
    }
  `],
})
export class ContentSectionComponent {
  @Input() section!: ContentSection;
}
