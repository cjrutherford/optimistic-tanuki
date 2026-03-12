import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CreateClassifiedAdDto,
  UpdateClassifiedAdDto,
  CLASSIFIED_CATEGORIES,
  CLASSIFIED_CONDITIONS,
  ClassifiedAdDto,
} from '../models/index';

@Component({
  selector: 'lib-classified-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="classified-form">
      <h2>{{ isEdit ? 'Edit Listing' : 'Post a New Listing' }}</h2>

      <div class="form-group">
        <label for="title">Title *</label>
        <input
          id="title"
          type="text"
          [(ngModel)]="formData.title"
          placeholder="What are you selling?"
          maxlength="255"
          required
        />
      </div>

      <div class="form-group">
        <label for="description">Description *</label>
        <textarea
          id="description"
          [(ngModel)]="formData.description"
          placeholder="Describe your item…"
          rows="4"
          required
        ></textarea>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="price">Price *</label>
          <input
            id="price"
            type="number"
            [(ngModel)]="formData.price"
            min="0"
            step="0.01"
            placeholder="0.00"
            required
          />
        </div>
        <div class="form-group">
          <label for="currency">Currency</label>
          <input id="currency" type="text" [(ngModel)]="formData.currency" placeholder="USD" maxlength="10" />
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" [(ngModel)]="formData.category">
            <option value="">— Select —</option>
            @for (cat of categories; track cat) {
              <option [value]="cat">{{ cat }}</option>
            }
          </select>
        </div>
        <div class="form-group">
          <label for="condition">Condition</label>
          <select id="condition" [(ngModel)]="formData.condition">
            <option value="">— Select —</option>
            @for (cond of conditions; track cond) {
              <option [value]="cond">{{ cond }}</option>
            }
          </select>
        </div>
      </div>

      @if (error()) {
        <p class="form-error" role="alert">{{ error() }}</p>
      }

      <div class="form-actions">
        <button class="btn btn-secondary" type="button" (click)="cancel.emit()">
          Cancel
        </button>
        <button
          class="btn btn-primary"
          type="button"
          [disabled]="submitting()"
          (click)="onSubmit()"
        >
          {{ submitting() ? 'Saving…' : isEdit ? 'Update Listing' : 'Post Listing' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .classified-form {
      max-width: 560px;
      margin: 0 auto;
      padding: 24px;
      background: var(--surface, #fff);
      border-radius: 10px;
      border: 1px solid var(--border, #e0e0e0);
    }
    h2 { margin-top: 0; font-size: 1.3rem; margin-bottom: 20px; }
    .form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 4px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    label { font-size: 0.9rem; font-weight: 500; }
    input, textarea, select {
      padding: 8px 12px;
      border: 1px solid var(--border, #ccc);
      border-radius: 6px;
      font-size: 0.9rem;
      font-family: inherit;
      background: var(--input-bg, #fafafa);
      &:focus { outline: 2px solid var(--primary, #3f51b5); border-color: transparent; }
    }
    textarea { resize: vertical; }
    .form-error { color: var(--error, #d32f2f); font-size: 0.9rem; }
    .form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px; }
    .btn { padding: 8px 20px; border-radius: 6px; border: none; font-size: 0.9rem; cursor: pointer; }
    .btn-primary { background: var(--primary, #3f51b5); color: #fff; &:hover:not(:disabled) { opacity: 0.9; } &:disabled { opacity: 0.5; cursor: not-allowed; } }
    .btn-secondary { background: transparent; border: 1px solid var(--primary, #3f51b5); color: var(--primary, #3f51b5); &:hover { background: rgba(63,81,181,0.05); } }
  `],
})
export class ClassifiedFormComponent implements OnInit {
  /** Optional existing ad for edit mode */
  @Input() existingAd?: ClassifiedAdDto;
  @Input({ required: true }) communityId!: string;

  @Output() submitForm = new EventEmitter<
    CreateClassifiedAdDto | UpdateClassifiedAdDto
  >();
  @Output() cancel = new EventEmitter<void>();

  readonly categories = CLASSIFIED_CATEGORIES;
  readonly conditions = CLASSIFIED_CONDITIONS;

  formData: CreateClassifiedAdDto = {
    communityId: '',
    title: '',
    description: '',
    price: 0,
    currency: 'USD',
    category: '',
    condition: '',
  };

  error = signal<string | null>(null);
  submitting = signal(false);

  get isEdit(): boolean {
    return !!this.existingAd;
  }

  ngOnInit(): void {
    this.formData.communityId = this.communityId;
    if (this.existingAd) {
      this.formData = {
        communityId: this.communityId,
        title: this.existingAd.title,
        description: this.existingAd.description,
        price: this.existingAd.price,
        currency: this.existingAd.currency,
        category: this.existingAd.category ?? '',
        condition: this.existingAd.condition ?? '',
        imageUrls: this.existingAd.imageUrls ?? [],
      };
    }
  }

  onSubmit(): void {
    this.error.set(null);
    if (!this.formData.title.trim()) {
      this.error.set('Title is required.');
      return;
    }
    if (!this.formData.description.trim()) {
      this.error.set('Description is required.');
      return;
    }
    if (this.formData.price < 0) {
      this.error.set('Price must be 0 or greater.');
      return;
    }

    this.submitting.set(true);
    const payload: CreateClassifiedAdDto | UpdateClassifiedAdDto = {
      ...this.formData,
      category: this.formData.category || undefined,
      condition: this.formData.condition || undefined,
    };
    this.submitForm.emit(payload);
    this.submitting.set(false);
  }
}
