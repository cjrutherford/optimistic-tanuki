import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClassifiedAdDto } from '../models/index';
import { ClassifiedCardComponent } from '../classified-card/classified-card.component';

@Component({
  selector: 'lib-classified-list',
  standalone: true,
  imports: [CommonModule, ClassifiedCardComponent],
  template: `
    <div class="classified-list">
      <div class="list-header">
        <h2>Classifieds</h2>
        @if (showPostButton) {
          <button class="btn btn-primary" (click)="postNew.emit()">
            + Post Ad
          </button>
        }
      </div>

      @if (loading) {
        <div class="loading-state">
          <p>Loading classifieds…</p>
        </div>
      } @else if (ads.length === 0) {
        <div class="empty-state">
          <p>No classified ads yet.</p>
          @if (showPostButton) {
            <button class="btn btn-outline" (click)="postNew.emit()">
              Be the first to post!
            </button>
          }
        </div>
      } @else {
        <div class="grid">
          @for (ad of ads; track ad.id) {
            <lib-classified-card
              [ad]="ad"
              [showContact]="showContact"
              (view)="viewAd.emit($event)"
              (contact)="contactSeller.emit($event)"
            ></lib-classified-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .classified-list { padding: 0; }
    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      h2 { margin: 0; font-size: 1.4rem; color: var(--foreground); }
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 40px 16px;
      color: var(--foreground-muted, #757575);
      background: color-mix(in srgb, var(--surface) 88%, transparent);
      border: 1px dashed color-mix(in srgb, var(--border, var(--muted)) 75%, transparent);
      border-radius: 18px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .btn { padding: 10px 18px; border-radius: 999px; border: none; font-size: 0.9rem; cursor: pointer; font-weight: 600; }
    .btn-primary { background: var(--primary, #3f51b5); color: #fff; &:hover { opacity: 0.9; } }
    .btn-outline { background: color-mix(in srgb, var(--surface) 82%, transparent); border: 1px solid color-mix(in srgb, var(--primary) 32%, var(--border, var(--muted))); color: var(--primary, #3f51b5); &:hover { background: color-mix(in srgb, var(--primary) 8%, var(--surface)); } }
  `],
})
export class ClassifiedListComponent {
  @Input({ required: true }) ads: ClassifiedAdDto[] = [];
  @Input() loading = false;
  /** Whether to show the "Post Ad" button (visible to auth + joined users) */
  @Input() showPostButton = false;
  /** Whether to show "Contact Seller" on cards */
  @Input() showContact = false;

  @Output() postNew = new EventEmitter<void>();
  @Output() viewAd = new EventEmitter<ClassifiedAdDto>();
  @Output() contactSeller = new EventEmitter<ClassifiedAdDto>();
}
