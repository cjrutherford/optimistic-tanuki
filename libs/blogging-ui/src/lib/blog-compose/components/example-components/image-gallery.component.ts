import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-image-gallery',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <otui-card class="image-gallery">
      @if (title) {
      <div class="gallery-header">
        <h3>{{ title }}</h3>
      </div>
      }
      <div class="gallery-grid" [ngClass]="'columns-' + columns">
        @for (image of images; track image; let i = $index) {
        <div
          class="gallery-item"
          (click)="selectImage(i)"
          (keyup.enter)="selectImage(i)"
          tabindex="0"
        >
          <img [src]="image.url" [alt]="image.alt || 'Gallery image'" />
          @if (image.caption) {
          <div class="image-overlay">
            <span>{{ image.caption }}</span>
          </div>
          }
        </div>
        }
      </div>
    </otui-card>
  `,
  styles: [
    `
      .image-gallery {
        margin: 1rem 0;
      }

      .gallery-header {
        padding: 1rem 1rem 0 1rem;
      }

      .gallery-header h3 {
        margin: 0;
        font-size: 1.2rem;
      }

      .gallery-grid {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .columns-1 {
        grid-template-columns: 1fr;
      }

      .columns-2 {
        grid-template-columns: repeat(2, 1fr);
      }

      .columns-3 {
        grid-template-columns: repeat(3, 1fr);
      }

      .columns-4 {
        grid-template-columns: repeat(4, 1fr);
      }

      .gallery-item {
        position: relative;
        cursor: pointer;
        border-radius: 4px;
        overflow: hidden;
        transition: transform 0.2s;
      }

      .gallery-item:hover {
        transform: scale(1.02);
      }

      .gallery-item img {
        width: 100%;
        height: auto;
        display: block;
      }

      .image-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
        color: white;
        padding: 1rem;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class ImageGalleryComponent {
  @Input() title = '';
  @Input() columns: 1 | 2 | 3 | 4 = 3;
  @Input() images: Array<{ url: string; alt?: string; caption?: string }> = [
    {
      url: 'https://picsum.photos/300/200?random=1',
      alt: 'Sample image 1',
      caption: 'Sample caption 1',
    },
    {
      url: 'https://picsum.photos/300/200?random=2',
      alt: 'Sample image 2',
      caption: 'Sample caption 2',
    },
    {
      url: 'https://picsum.photos/300/200?random=3',
      alt: 'Sample image 3',
      caption: 'Sample caption 3',
    },
  ];

  selectImage(index: number): void {
    // Could emit an event or open a modal
    console.log('Selected image:', this.images[index]);
  }
}
