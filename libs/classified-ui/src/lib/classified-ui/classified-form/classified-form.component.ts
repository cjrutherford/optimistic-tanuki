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

      <div class="form-group">
        <label>Images (optional, up to 5)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          [disabled]="imageUploading()"
          (change)="onFilesSelected($event)"
          class="file-input"
        />
        @if (imageUploading()) {
          <p class="upload-status">Uploading images…</p>
        }
        @if (imagePreviews().length > 0) {
          <div class="image-previews">
            @for (preview of imagePreviews(); track preview; let i = $index) {
              <div class="preview-item">
                <img [src]="preview" alt="Image preview" />
                <button type="button" class="remove-image" (click)="removeImage(i)" aria-label="Remove image">✕</button>
              </div>
            }
          </div>
        }
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
          [disabled]="submitting() || imageUploading()"
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
    .file-input { font-size: 0.85rem; }
    .upload-status { font-size: 0.85rem; color: var(--primary, #3f51b5); margin: 4px 0 0; }
    .image-previews { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .preview-item { position: relative; }
    .preview-item img { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border, #ccc); }
    .remove-image { position: absolute; top: -6px; right: -6px; background: #d32f2f; color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 10px; line-height: 18px; text-align: center; cursor: pointer; padding: 0; }
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
  /**
   * Optional callback to handle image upload. Receives a File and returns a
   * Promise<string> with the uploaded image URL. When not provided, the form
   * still works but image upload will be skipped.
   */
  @Input() uploadImage?: (file: File) => Promise<string>;

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
    imageUrls: [],
  };

  error = signal<string | null>(null);
  submitting = signal(false);
  imageUploading = signal(false);
  /** Data-URL previews for images selected by the user */
  imagePreviews = signal<string[]>([]);

  get isEdit(): boolean {
    return !!this.existingAd;
  }

  ngOnInit(): void {
    this.formData.communityId = this.communityId;
    if (this.existingAd) {
      const existingUrls = this.existingAd.imageUrls ?? [];
      this.formData = {
        communityId: this.communityId,
        title: this.existingAd.title,
        description: this.existingAd.description,
        price: this.existingAd.price,
        currency: this.existingAd.currency,
        category: this.existingAd.category ?? '',
        condition: this.existingAd.condition ?? '',
        imageUrls: [...existingUrls],
      };
      // Show existing images as previews
      this.imagePreviews.set([...existingUrls]);
    }
  }

  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const files = Array.from(input.files).slice(0, 5 - (this.formData.imageUrls?.length ?? 0));
    if (!files.length) return;

    // Show local previews immediately
    const previewPromises = files.map(
      (f) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(f);
        })
    );
    const newPreviews = await Promise.all(previewPromises);
    this.imagePreviews.update((p) => [...p, ...newPreviews].slice(0, 5));

    if (this.uploadImage) {
      this.imageUploading.set(true);
      const results = await Promise.allSettled(files.map((f) => this.uploadImage!(f)));
      const uploadedUrls: string[] = [];
      const failedNames: string[] = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
          uploadedUrls.push(result.value);
        } else {
          failedNames.push(files[i].name);
        }
      });
      if (uploadedUrls.length > 0) {
        this.formData.imageUrls = [...(this.formData.imageUrls ?? []), ...uploadedUrls].slice(0, 5);
      }
      if (failedNames.length > 0) {
        this.error.set(`Failed to upload: ${failedNames.join(', ')}. Please try again.`);
        // Roll back previews for failed files only
        const failedIndexes = new Set(results.map((r, i) => r.status === 'rejected' ? i : -1).filter((i) => i >= 0));
        const successPreviews = newPreviews.filter((_, i) => !failedIndexes.has(i));
        this.imagePreviews.update((p) => [
          ...p.slice(0, (this.formData.imageUrls ?? []).length - successPreviews.length),
          ...successPreviews,
        ].slice(0, 5));
      }
      this.imageUploading.set(false);
    } else {
      // No upload callback provided — store data URLs directly (dev/fallback)
      this.formData.imageUrls = [
        ...(this.formData.imageUrls ?? []),
        ...newPreviews,
      ].slice(0, 5);
    }

    // Reset the file input so the same files can be re-selected
    input.value = '';
  }

  removeImage(index: number): void {
    this.imagePreviews.update((p) => p.filter((_, i) => i !== index));
    if (this.formData.imageUrls) {
      this.formData.imageUrls = this.formData.imageUrls.filter((_, i) => i !== index);
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
