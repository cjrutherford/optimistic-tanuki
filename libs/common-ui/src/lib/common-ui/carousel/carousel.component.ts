import { Component, Input, ContentChildren, QueryList, AfterContentInit, ElementRef } from '@angular/core';

@Component({
  selector: 'lib-carousel',
  template: `
    <div class="carousel">
      <div class="carousel-inner" [style.transform]="getTransform()">
        <ng-content></ng-content>
      </div>
      <button class="carousel-control prev" (click)="prev()">&#10094;</button>
      <button class="carousel-control next" (click)="next()">&#10095;</button>
    </div>
  `,
  styles: [
    `
    .carousel {
      position: relative;
      overflow: hidden;
      width: 100%;
    }
    .carousel-inner {
      display: flex;
      transition: transform 0.5s ease;
    }
    ::ng-deep .carousel-inner > * {
      flex: 0 0 calc(60% / var(--visible-items, 1));
      height: 100%;
      box-sizing: border-box;
    }
    .carousel-control {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      font-size: 2rem;
      cursor: pointer;
    }
    .carousel-control.prev {
      left: 0;
    }
    .carousel-control.next {
      right: 0;
    }
    `
  ]
})
export class CarouselComponent implements AfterContentInit {
  @ContentChildren('carouselItem') items!: QueryList<ElementRef>;
  @Input() visibleItems = 1;
  private currentIndex = 0;

  ngAfterContentInit() {
    if (this.items.length < this.visibleItems) {
      console.warn('Not enough items to display in the carousel');
    }

    // Dynamically set CSS variable for visible items
    const carouselInner = (this.items.first?.nativeElement as HTMLElement)?.parentElement;
    if (carouselInner) {
      carouselInner.style.setProperty('--visible-items', this.visibleItems.toString());
    }
  }

  getTransform(): string {
    return `translateX(-${this.currentIndex * (100 / this.visibleItems)}%)`;
  }

  next(): void {
    if (this.currentIndex < this.items.length - this.visibleItems) {
      this.currentIndex++;
    }
  }

  prev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
    }
  }
}