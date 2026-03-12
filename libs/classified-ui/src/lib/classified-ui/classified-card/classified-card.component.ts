import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ClassifiedAdDto } from '../models/index';

@Component({
  selector: 'lib-classified-card',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe],
  template: `
    <div class="classified-card" [class.featured]="ad.isFeatured">
      @if (ad.isFeatured) {
        <span class="featured-badge">⭐ Featured</span>
      }
      @if (ad.imageUrls && ad.imageUrls.length > 0) {
        <img
          [src]="ad.imageUrls[0]"
          [alt]="ad.title"
          class="card-image"
          loading="lazy"
        />
      } @else {
        <div class="card-image-placeholder">
          <span>No image</span>
        </div>
      }
      <div class="card-body">
        <h3 class="card-title">{{ ad.title }}</h3>
        @if (ad.category) {
          <span class="card-category">{{ ad.category }}</span>
        }
        <p class="card-description">{{ ad.description | slice: 0 : 120 }}{{ ad.description.length > 120 ? '…' : '' }}</p>
        <div class="card-meta">
          <span class="card-price">{{ ad.price | currency: ad.currency }}</span>
          @if (ad.condition) {
            <span class="card-condition">{{ ad.condition }}</span>
          }
        </div>
        <div class="card-footer">
          <span class="card-date">{{ ad.createdAt | date: 'mediumDate' }}</span>
          <span class="card-status" [class]="'status-' + ad.status">
            {{ ad.status }}
          </span>
        </div>
        <div class="card-actions">
          <button class="btn btn-primary" (click)="view.emit(ad)">
            View Details
          </button>
          @if (showContact) {
            <button class="btn btn-secondary" (click)="contact.emit(ad)">
              Contact Seller
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .classified-card {
      border: 1px solid var(--border, #e0e0e0);
      border-radius: 8px;
      overflow: hidden;
      background: var(--surface, #fff);
      transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
      &.featured {
        border-color: var(--primary, #3f51b5);
        box-shadow: 0 2px 8px rgba(63,81,181,0.2);
      }
    }
    .featured-badge {
      display: block;
      background: var(--primary, #3f51b5);
      color: #fff;
      font-size: 0.75rem;
      padding: 2px 10px;
      text-align: center;
    }
    .card-image {
      width: 100%;
      height: 180px;
      object-fit: cover;
    }
    .card-image-placeholder {
      width: 100%;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-variant, #f5f5f5);
      color: var(--on-surface-variant, #757575);
      font-size: 0.9rem;
    }
    .card-body { padding: 12px; }
    .card-title { font-size: 1rem; font-weight: 600; margin: 0 0 4px; }
    .card-category {
      display: inline-block;
      font-size: 0.75rem;
      background: var(--secondary, #9c27b0);
      color: #fff;
      padding: 1px 8px;
      border-radius: 12px;
      margin-bottom: 6px;
    }
    .card-description { font-size: 0.85rem; color: var(--on-surface-variant, #555); margin: 4px 0 8px; }
    .card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .card-price { font-size: 1.1rem; font-weight: 700; color: var(--primary, #3f51b5); }
    .card-condition { font-size: 0.75rem; color: var(--on-surface-variant, #757575); }
    .card-footer { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--on-surface-variant, #757575); margin-bottom: 10px; }
    .status-sold { color: #d32f2f; }
    .status-active { color: #388e3c; }
    .card-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 0.85rem; cursor: pointer; }
    .btn-primary { background: var(--primary, #3f51b5); color: #fff; &:hover { opacity: 0.9; } }
    .btn-secondary { background: transparent; border: 1px solid var(--primary, #3f51b5); color: var(--primary, #3f51b5); &:hover { background: rgba(63,81,181,0.05); } }
  `],
})
export class ClassifiedCardComponent {
  @Input({ required: true }) ad!: ClassifiedAdDto;
  /** Whether to show the "Contact Seller" button */
  @Input() showContact = false;
  @Output() view = new EventEmitter<ClassifiedAdDto>();
  @Output() contact = new EventEmitter<ClassifiedAdDto>();
}
