import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

let nextDropZoneId = 0;

@Component({
  selector: 'otui-document-drop-zone',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="otui-drop-zone"
      [class.drag-over]="isDragOver"
      [class.disabled]="disabled"
      role="button"
      [attr.tabindex]="disabled ? -1 : 0"
      [attr.aria-disabled]="disabled"
      [attr.aria-labelledby]="labelId"
      [attr.aria-describedby]="descriptionId"
      (click)="onClick($event)"
      (keydown)="onKeydown($event)"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <input
        #fileInput
        [id]="inputId"
        type="file"
        class="file-input-hidden"
        [accept]="acceptedFormats"
        (change)="onFileSelected($event)"
        [disabled]="disabled"
        tabindex="-1"
      />

      <div class="drop-zone-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>

      <div class="drop-zone-content">
        <label
          class="drop-zone-title"
          [attr.id]="labelId"
          [attr.for]="inputId"
          >{{ label }}</label
        >
        <p class="drop-zone-subtitle" [id]="descriptionId">
          Drag and drop files here, or activate to browse. Max
          {{ maxSizeBytes / (1024 * 1024) }} MB.
        </p>

        <div *ngIf="selectedFile" class="selected-file-badge">
          <span class="file-name">{{ selectedFile.name }}</span>
          <span class="file-size"
            >({{ (selectedFile.size / 1024).toFixed(1) }} KB)</span
          >
        </div>

        <div
          *ngIf="scanning"
          class="scan-status-container"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div class="scan-spinner" aria-hidden="true"></div>
          <span class="scan-text">{{
            scanStatus || 'Scanning file with ClamAV daemon...'
          }}</span>
        </div>

        <div *ngIf="errorMessage" class="error-banner" role="alert">
          {{ errorMessage }}
        </div>

        <div *ngIf="chainedHash" class="compliance-badge-row">
          <span class="compliance-pill">FTC 16 CFR Part 314</span>
          <span class="compliance-pill">IRS Pub 4557</span>
          <span class="hash-pill"
            >SHA-256: {{ chainedHash.substring(0, 16) }}...</span
          >
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .otui-drop-zone {
        border: 2px dashed
          color-mix(in srgb, var(--border-strong) 70%, transparent);
        border-radius: 8px;
        padding: 32px 24px;
        text-align: center;
        background: color-mix(in srgb, var(--surface) 80%, transparent);
        color: var(--foreground);
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
      }
      .otui-drop-zone:hover,
      .otui-drop-zone.drag-over {
        border-color: var(--accent);
        background: color-mix(in srgb, var(--surface) 95%, var(--accent) 5%);
      }
      .otui-drop-zone:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 3px;
      }
      .otui-drop-zone.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .file-input-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .drop-zone-icon {
        margin-bottom: 12px;
        color: var(--accent);
      }
      .drop-zone-title {
        display: inline-block;
        margin: 0 0 6px 0;
        font-size: 1.1rem;
        font-weight: 600;
        color: var(--foreground);
        cursor: inherit;
      }
      .drop-zone-subtitle {
        margin: 0;
        font-size: 0.875rem;
        color: var(--foreground-muted);
      }
      .selected-file-badge {
        margin-top: 14px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 0.875rem;
        color: var(--foreground);
      }
      .scan-status-container {
        margin-top: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: var(--accent);
        font-size: 0.875rem;
      }
      .scan-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid color-mix(in srgb, var(--accent) 30%, transparent);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      .error-banner {
        margin-top: 14px;
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
        color: var(--danger-foreground);
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 0.85rem;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .compliance-badge-row {
        margin-top: 14px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: center;
      }
      .compliance-pill {
        background: var(--trust-badge-bg);
        border: 1px solid color-mix(in srgb, var(--success) 40%, transparent);
        color: var(--trust-badge-color);
        font-size: 0.75rem;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
      }
      .hash-pill {
        background: color-mix(
          in srgb,
          var(--foreground-muted) 15%,
          transparent
        );
        border: 1px solid
          color-mix(in srgb, var(--foreground-muted) 30%, transparent);
        color: var(--foreground-secondary);
        font-size: 0.75rem;
        font-family: var(--font-mono, monospace);
        padding: 2px 8px;
        border-radius: 4px;
      }
      @media (prefers-reduced-motion: reduce) {
        .otui-drop-zone,
        .scan-spinner {
          transition: none;
          animation: none;
        }
      }
    `,
  ],
})
export class DocumentDropZoneComponent {
  @Input() token = '';
  @Input() label = 'Upload confidential client document';
  @Input() acceptedFormats = '.pdf,.doc,.docx,.xlsx,.png,.jpg,.jpeg';
  @Input() maxSizeBytes = 25 * 1024 * 1024;
  @Input() disabled = false;
  @Input() scanning = false;
  @Input() scanStatus = '';
  @Input() chainedHash?: string;
  @Input() inputId = `otui-document-drop-zone-input-${++nextDropZoneId}`;

  @Output() fileSelected = new EventEmitter<File>();
  @Output() fileRejected = new EventEmitter<string>();

  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  isDragOver = false;
  selectedFile: File | null = null;
  errorMessage = '';
  labelId = `otui-document-drop-zone-label-${++nextDropZoneId}`;
  descriptionId = `otui-document-drop-zone-description-${++nextDropZoneId}`;

  onClick(event: MouseEvent): void {
    if (this.disabled || event.target === this.fileInputRef?.nativeElement) {
      return;
    }
    event.preventDefault();
    this.openFilePicker();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.disabled || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }
    event.preventDefault();
    this.openFilePicker();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.disabled) {
      this.isDragOver = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    if (this.disabled) return;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private openFilePicker(): void {
    if (!this.disabled) {
      this.fileInputRef?.nativeElement.click();
    }
  }

  private handleFile(file: File): void {
    if (file.size > this.maxSizeBytes) {
      this.errorMessage = `File size exceeds ${
        this.maxSizeBytes / (1024 * 1024)
      } MB limit.`;
      this.fileRejected.emit(this.errorMessage);
      return;
    }
    this.errorMessage = '';
    this.selectedFile = file;
    this.fileSelected.emit(file);
  }
}
