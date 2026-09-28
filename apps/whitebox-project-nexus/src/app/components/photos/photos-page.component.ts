import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { InspectionPhotoResponseDto } from '@optimistic-tanuki/models';
import { ProjectNexusApiService } from '../../services/project-nexus-api.service';
import { NexusFieldSyncService } from '../../services/nexus-field-sync.service';

@Component({
  selector: 'nexus-photos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page-container">
      <p class="eyebrow">Jobsite evidence locker</p>
      <h1 class="page-title">Inspection photos</h1>
      <p class="page-lead">
        Every photo is hashed with SHA-256 and its GPS is read from the file
        itself, never from a claim. Photos queue locally when the trailer
        network is down.
      </p>

      <div class="upload-card">
        <label class="input-label" for="photoFile"
          >Upload inspection photo</label
        >
        <div class="input-row">
          <input
            id="photoFile"
            type="file"
            accept="image/jpeg,image/png"
            (change)="onFileSelected($event)"
            [disabled]="isUploading"
          />
          <button
            type="button"
            class="btn-upload"
            [disabled]="!selectedFile || isUploading"
            (click)="uploadSelected()"
          >
            <span *ngIf="!isUploading">Seal photo</span>
            <span *ngIf="isUploading">Sealing...</span>
          </button>
        </div>
        <div *ngIf="uploadError" class="error-banner" role="alert">
          {{ uploadError }}
        </div>
        <div *ngIf="uploadStatus" class="status-note" role="status">
          {{ uploadStatus }}
        </div>
      </div>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>

      <div *ngIf="photos.length > 0" class="photo-grid">
        <div *ngFor="let photo of photos" class="photo-card">
          <div class="photo-name">{{ photo.fileName }}</div>
          <div class="photo-hash" [title]="photo.sha256">
            SHA-256 {{ photo.sha256.substring(0, 16) }}...
          </div>
          <div class="photo-meta">
            <span
              class="scan-pill"
              [class.scan-clean]="photo.antivirusStatus === 'clean'"
            >
              {{ photo.antivirusStatus }}
            </span>
            <span *ngIf="photo.gps" class="gps-pill">
              {{ photo.gps.latitude.toFixed(5) }},
              {{ photo.gps.longitude.toFixed(5) }}
            </span>
            <span *ngIf="!photo.gps" class="gps-missing">
              No location on file
            </span>
          </div>
        </div>
      </div>

      <p
        *ngIf="!loading && photos.length === 0 && !loadError"
        class="empty-note"
      >
        No inspection photos are sealed for this project yet.
      </p>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1100px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 10px 0;
      }
      .page-lead {
        color: var(--foreground-muted);
        line-height: 1.6;
        margin: 0 0 24px 0;
        max-width: 640px;
      }
      .upload-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
        max-width: 640px;
      }
      .input-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--foreground-muted);
        margin-bottom: 8px;
      }
      .input-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
      }
      .btn-upload {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        padding: 10px 18px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-upload:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error-banner {
        margin-top: 12px;
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
        color: var(--danger);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 0.88rem;
      }
      .status-note {
        margin-top: 12px;
        color: var(--accent);
        font-size: 0.88rem;
      }
      .photo-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
      }
      @media (max-width: 800px) {
        .photo-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 500px) {
        .photo-grid {
          grid-template-columns: 1fr;
        }
      }
      .photo-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 10px;
        padding: 14px;
      }
      .photo-name {
        font-weight: 600;
        color: var(--foreground);
        margin-bottom: 4px;
      }
      .photo-hash {
        font-family: monospace;
        font-size: 0.75rem;
        color: var(--foreground-muted);
        margin-bottom: 8px;
      }
      .photo-meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        font-size: 0.75rem;
      }
      .scan-pill {
        background: color-mix(in srgb, var(--success) 15%, transparent);
        color: var(--success);
        border-radius: 4px;
        padding: 2px 8px;
        font-weight: 600;
      }
      .scan-clean {
        text-transform: uppercase;
      }
      .gps-pill {
        background: color-mix(in srgb, var(--accent) 15%, transparent);
        color: var(--accent);
        border-radius: 4px;
        padding: 2px 8px;
        font-family: monospace;
      }
      .gps-missing {
        color: var(--foreground-muted);
      }
      .empty-note {
        color: var(--foreground-muted);
      }
    `,
  ],
})
export class PhotosPageComponent implements OnInit {
  projectId = '';
  photos: InspectionPhotoResponseDto[] = [];
  loading = true;
  loadError = '';
  uploadError = '';
  uploadStatus = '';
  isUploading = false;
  selectedFile: File | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ProjectNexusApiService,
    private readonly sync: NexusFieldSyncService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.projectId) {
      this.loading = false;
      this.loadError = 'A project ID is required.';
      return;
    }
    void this.load();
    void this.sync.updatePendingCount();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile =
      input.files && input.files.length > 0 ? input.files[0] : null;
    this.uploadError = '';
    this.uploadStatus = '';
  }

  uploadSelected(): void {
    if (!this.selectedFile || this.isUploading) {
      return;
    }
    this.uploadError = '';
    this.uploadStatus = '';
    this.isUploading = true;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result ?? '').split(',')[1] ?? '';
      if (!base64) {
        this.isUploading = false;
        this.uploadError = 'The selected file could not be read.';
        return;
      }
      const fileName = this.selectedFile?.name ?? 'photo.jpg';
      this.api
        .uploadInspectionPhoto(this.projectId, {
          projectId: this.projectId,
          fileName,
          mimeType: this.selectedFile?.type || 'image/jpeg',
          fileBase64: base64,
        })
        .subscribe({
          next: (photo) => {
            this.isUploading = false;
            this.selectedFile = null;
            this.uploadStatus = `Sealed ${photo.fileName} with SHA-256 proof.`;
            void this.rememberPhoto(photo);
          },
          error: (error: unknown) => {
            this.isUploading = false;
            const message =
              typeof error === 'object' &&
              error !== null &&
              'error' in error &&
              typeof (error as { error?: { message?: unknown } }).error
                ?.message === 'string'
                ? String(
                    (error as { error: { message: string } }).error.message
                  )
                : 'The photo could not be sealed. Nothing was stored.';
            this.uploadError = message;
          },
        });
    };
    reader.onerror = () => {
      this.isUploading = false;
      this.uploadError = 'The selected file could not be read.';
    };
    reader.readAsDataURL(this.selectedFile);
  }

  private async load(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const cached = await this.sync.cachedPhotos(this.projectId);
      if (cached) {
        this.photos = cached;
      }
    }
    this.loading = false;
  }

  private async rememberPhoto(
    photo: InspectionPhotoResponseDto
  ): Promise<void> {
    this.photos = [...this.photos, photo];
    if (isPlatformBrowser(this.platformId)) {
      await this.sync.cacheSnapshot(this.projectId, 'photos', this.photos);
    }
  }
}
