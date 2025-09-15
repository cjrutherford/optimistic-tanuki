import { CommonModule } from '@angular/common';
import { Component, Input, ContentChildren, QueryList, AfterContentInit, ElementRef } from '@angular/core';

@Component({
  selector: 'lib-carousel',
  imports: [CommonModule],
  standalone: true,
  template: `
    <div class="carousel">
      <div class="carousel-inner" [style.transform]="getTransform()" [style.gap]="gap">
        <div *ngFor="let item of visibleItemsArray" class="carousel-item">
          <ng-container *ngTemplateOutlet="item.template"></ng-container>
        </div>
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
      overflow: hidden;
    }
    .carousel-item {
      flex: 0 0 calc(100% / var(--visible-items, 1));
      height: 100%;
      box-sizing: border-box;
    }
    .carousel-control {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.5);
      border: none;
      font-size: 2rem;
      color: white;
      cursor: pointer;
      z-index: 1;
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
  visibleItemsArray: ElementRef[] = [];
  gap = '10px';

  ngAfterContentInit() {
    this.updateVisibleItems();

    if (this.items.length < 0) {
      console.warn('Not enough items to display in the carousel');
    }
    console.log(this.items);
    console.log(this.visibleItems);
  }

  private updateVisibleItems(): void {
    const start = this.currentIndex;
    const end = this.currentIndex + this.visibleItems;
    this.visibleItemsArray = this.items.toArray().slice(start, end);
  }

  getTransform(): string {
    return `translateX(-${this.currentIndex * (100 / this.visibleItems)}%)`;
  }

  next(): void {
    if (this.currentIndex < this.items.length - this.visibleItems) {
      this.currentIndex++;
      this.updateVisibleItems();
      this.updateTransform();
    }
  }

  prev(): void {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateVisibleItems();
      this.updateTransform();
    }
  }

  private updateTransform(): void {
    const carouselInner = this.items.first?.nativeElement.parentElement;
    if (carouselInner) {
      carouselInner.style.transform = `translateX(-${this.currentIndex * (100 / this.visibleItems)}%)`;
    }
  }
}