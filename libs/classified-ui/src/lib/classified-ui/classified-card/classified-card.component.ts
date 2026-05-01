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
      } @if (ad.imageUrls && ad.imageUrls.length > 0) {
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
        <div class="seller-row">
          <div class="seller-avatar" [class.has-image]="!!ad.sellerProfilePic">
            @if (ad.sellerProfilePic) {
            <img [src]="ad.sellerProfilePic" [alt]="ad.sellerProfileName || 'Seller'" />
            } @else {
            <span>{{ sellerInitials }}</span>
            }
          </div>
          <div class="seller-meta">
            <span class="seller-label">Listed by</span>
            <strong class="seller-name">{{
              ad.sellerProfileName || 'Community member'
            }}</strong>
          </div>
        </div>
        <h3 class="card-title">{{ ad.title }}</h3>
        @if (ad.category) {
        <span class="card-category">{{ ad.category }}</span>
        }
        <p class="card-description">
          {{ ad.description | slice : 0 : 120
          }}{{ ad.description.length > 120 ? '…' : '' }}
        </p>
        <div class="card-meta">
          <span class="card-price">{{
            ad.price | currency : ad.currency
          }}</span>
          @if (ad.condition) {
          <span class="card-condition">{{ ad.condition }}</span>
          }
        </div>
        <div class="card-footer">
          <span class="card-date">{{
            ad.createdAt | date : 'mediumDate'
          }}</span>
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
  styles: [
    `
      .classified-card {
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 85%, transparent);
        border-radius: 18px;
        overflow: hidden;
        background: color-mix(in srgb, var(--surface) 94%, transparent);
        transition:
          box-shadow 0.2s ease,
          transform 0.2s ease,
          border-color 0.2s ease;
        &:hover {
          box-shadow: var(--shadow-card, 0 18px 40px rgba(15, 23, 42, 0.12));
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--primary) 35%, var(--border, var(--muted)));
        }
        &.featured {
          border-color: color-mix(in srgb, var(--primary) 55%, var(--secondary, var(--primary)));
          box-shadow: 0 20px 44px rgba(var(--primary-rgb, 63, 81, 181), 0.18);
        }
      }
      .featured-badge {
        display: block;
        background: linear-gradient(
          135deg,
          color-mix(in srgb, var(--primary) 88%, white),
          color-mix(in srgb, var(--secondary, var(--primary)) 82%, white)
        );
        color: var(--on-primary, #fff);
        font-size: 0.72rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 6px 10px;
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
        background: color-mix(in srgb, var(--surface) 65%, var(--background));
        color: var(--foreground-muted, #757575);
        font-size: 0.9rem;
      }
      .card-body {
        padding: 16px;
      }
      .seller-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .seller-avatar {
        width: 40px;
        height: 40px;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, var(--secondary, var(--primary)) 22%, var(--surface));
        color: var(--foreground);
        font-size: 0.8rem;
        font-weight: 700;
        overflow: hidden;
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 85%, transparent);
      }
      .seller-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .seller-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .seller-label {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--foreground-muted, #666);
      }
      .seller-name {
        font-size: 0.92rem;
        color: var(--foreground, #212121);
      }
      .card-title {
        font-size: 1rem;
        font-weight: 600;
        margin: 0 0 4px;
        color: var(--foreground, #212121);
      }
      .card-category {
        display: inline-block;
        font-size: 0.75rem;
        background: color-mix(in srgb, var(--secondary, var(--primary)) 18%, var(--surface));
        color: var(--foreground, #212121);
        padding: 4px 10px;
        border-radius: 999px;
        margin-bottom: 6px;
        border: 1px solid color-mix(in srgb, var(--secondary, var(--primary)) 28%, transparent);
      }
      .card-description {
        font-size: 0.85rem;
        color: var(--foreground-muted, #555);
        margin: 4px 0 8px;
      }
      .card-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .card-price {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--primary, #3f51b5);
      }
      .card-condition {
        display: inline-block;
        font-size: 0.7rem;
        font-weight: 500;
        color: var(--foreground, #212121);
        background: color-mix(in srgb, var(--surface-variant, var(--surface)) 88%, var(--surface));
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--border, var(--muted)) 75%, transparent);
      }
      .card-footer {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: var(--foreground-muted, #757575);
        margin-bottom: 10px;
      }
      .status-sold {
        color: var(--error, #d32f2f);
      }
      .status-active {
        color: var(--success, #388e3c);
      }
      .card-status {
        font-weight: 700;
        text-transform: capitalize;
      }
      .card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn {
        padding: 6px 14px;
        border-radius: 6px;
        border: none;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .btn-primary {
        background: var(--primary, #3f51b5);
        color: var(--on-primary, #fff);
        &:hover {
          opacity: 0.9;
        }
      }
      .btn-secondary {
        background: color-mix(in srgb, var(--surface) 82%, transparent);
        border: 1px solid color-mix(in srgb, var(--primary) 30%, var(--border, var(--muted)));
        color: var(--primary, #3f51b5);
        &:hover {
          background: color-mix(in srgb, var(--primary) 8%, var(--surface));
        }
      }
    `,
  ],
})
export class ClassifiedCardComponent {
  @Input({ required: true }) ad!: ClassifiedAdDto;
  /** Whether to show the "Contact Seller" button */
  @Input() showContact = false;
  @Output() view = new EventEmitter<ClassifiedAdDto>();
  @Output() contact = new EventEmitter<ClassifiedAdDto>();

  get sellerInitials(): string {
    const source = this.ad?.sellerProfileName?.trim() || 'CM';
    return source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }
}
