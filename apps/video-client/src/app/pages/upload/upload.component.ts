import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VideoService } from '../../services/video.service';
import { CreateVideoDto } from '@optimistic-tanuki/ui-models';
import { PulseRingsComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'video-upload',
  standalone: true,
  imports: [CommonModule, FormsModule, PulseRingsComponent],
  template: `
    <div class="upload-page">
      <div class="upload-container">
        <h1>Upload Video</h1>

        <form (ngSubmit)="onSubmit()" #uploadForm="ngForm">
          <!-- Video File -->
          <div class="form-group">
            <label for="videoFile">Video File *</label>
            <div class="file-drop-zone" [class.has-file]="videoFile">
              <input
                type="file"
                id="videoFile"
                accept="video/*"
                (change)="onVideoFileSelected($event)"
                required
              />
              <div class="drop-zone-content">
                <span class="drop-icon">🎬</span>
                <span class="drop-text">{{
                  videoFile ? videoFile.name : 'Choose or drop a video file'
                }}</span>
              </div>
            </div>
            <small class="form-hint">Supported: MP4, WebM, MOV</small>
          </div>

          <!-- Thumbnail -->
          <div class="form-group">
            <label for="thumbnailFile">Thumbnail (Optional)</label>
            <div class="file-drop-zone" [class.has-file]="thumbnailFile">
              <input
                type="file"
                id="thumbnailFile"
                accept="image/*"
                (change)="onThumbnailFileSelected($event)"
              />
              <div class="drop-zone-content">
                <span class="drop-icon">🖼️</span>
                <span class="drop-text">{{
                  thumbnailFile
                    ? thumbnailFile.name
                    : 'Choose or drop a thumbnail'
                }}</span>
              </div>
            </div>
            <small class="form-hint">Recommended: 1280x720 JPG or PNG</small>
          </div>

          <!-- Title -->
          <div class="form-group">
            <label for="title">Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              [(ngModel)]="videoData.title"
              maxlength="200"
              required
              placeholder="Enter video title"
            />
          </div>

          <!-- Description -->
          <div class="form-group">
            <label for="description">Description</label>
            <textarea
              id="description"
              name="description"
              [(ngModel)]="videoData.description"
              rows="5"
              maxlength="5000"
              placeholder="Tell viewers about your video"
            ></textarea>
          </div>

          <!-- Channel Selection -->
          <div class="form-group">
            <label for="channel">Channel *</label>
            <select
              id="channel"
              name="channelId"
              [(ngModel)]="videoData.channelId"
              required
            >
              <option value="">Select a channel</option>
              <option *ngFor="let channel of channels" [value]="channel.id">
                {{ channel.name }}
              </option>
            </select>
          </div>

          <!-- Visibility -->
          <div class="form-group">
            <label for="visibility">Visibility</label>
            <select
              id="visibility"
              name="visibility"
              [(ngModel)]="videoData.visibility"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted</option>
              <option value="private">Private</option>
            </select>
          </div>

          <!-- Upload Progress -->
          <div *ngIf="uploading" class="upload-progress">
            <div class="pulse-indicator">
              <otui-pulse-rings></otui-pulse-rings>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" [style.width.%]="uploadProgress"></div>
              <div class="progress-shimmer"></div>
            </div>
            <p>Uploading... {{ uploadProgress }}%</p>
          </div>

          <!-- Error Message -->
          <div *ngIf="error" class="error-message">
            {{ error }}
          </div>

          <!-- Success Message -->
          <div *ngIf="success" class="success-message">
            Video uploaded successfully! Redirecting...
          </div>

          <!-- Action Buttons -->
          <div class="form-actions">
            <button
              type="button"
              class="btn btn-secondary"
              (click)="onCancel()"
              [disabled]="uploading"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              [disabled]="!uploadForm.valid || !videoFile || uploading"
            >
              {{ uploading ? 'Uploading...' : 'Upload Video' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      .upload-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem 1rem;
      }

      .upload-container {
        backdrop-filter: blur(20px);
        background: rgba(var(--background-rgb, 10, 10, 15), 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: var(--personality-border-radius, 16px);
        padding: 2rem;
      }

      h1 {
        font-family: var(--font-heading, system-ui);
        font-size: 1.75rem;
        font-weight: 700;
        margin: 0 0 2rem 0;
        color: var(--foreground);
      }

      .form-group {
        margin-bottom: 1.5rem;
      }

      label {
        display: block;
        font-weight: 500;
        margin-bottom: 0.5rem;
        color: var(--foreground);
      }

      input[type='text'],
      textarea,
      select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: var(--personality-border-radius, 8px);
        font-size: 1rem;
        font-family: inherit;
        background: rgba(var(--background-rgb, 10, 10, 15), 0.5);
        color: var(--foreground);
        transition:
          border-color var(--animation-duration-fast, 0.15s)
            var(--animation-easing, ease),
          box-shadow var(--animation-duration-fast, 0.15s)
            var(--animation-easing, ease);
      }

      input[type='text']:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.5);
        box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 99, 102, 241), 0.15);
      }

      input[type='text']::placeholder,
      textarea::placeholder {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.35);
      }

      select option {
        background: var(--background, #0a0a0f);
        color: var(--foreground);
      }

      .file-drop-zone {
        position: relative;
        border: 2px dashed rgba(255, 255, 255, 0.12);
        border-radius: var(--personality-border-radius, 12px);
        padding: 2rem;
        text-align: center;
        transition: all var(--animation-duration-fast, 0.15s)
          var(--animation-easing, ease);
        background: rgba(var(--background-rgb, 10, 10, 15), 0.4);
        cursor: pointer;
      }

      .file-drop-zone:hover {
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.4);
        background: rgba(var(--accent-rgb, 99, 102, 241), 0.05);
      }

      .file-drop-zone.has-file {
        border-color: rgba(var(--accent-rgb, 99, 102, 241), 0.3);
        background: rgba(var(--accent-rgb, 99, 102, 241), 0.08);
      }

      .file-drop-zone input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }

      .drop-zone-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        pointer-events: none;
      }

      .drop-icon {
        font-size: 2rem;
      }

      .drop-text {
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.6);
        font-size: 0.9rem;
      }

      textarea {
        resize: vertical;
        min-height: 100px;
      }

      .form-hint {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.875rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.45);
      }

      .upload-progress {
        margin: 1.5rem 0;
        position: relative;
      }

      .pulse-indicator {
        display: flex;
        justify-content: center;
        margin-bottom: 1rem;
        height: 60px;
      }

      .progress-bar {
        width: 100%;
        height: 8px;
        background: rgba(var(--foreground-rgb, 232, 232, 236), 0.1);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 0.5rem;
        position: relative;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--accent, #6366f1),
          rgba(var(--accent-rgb, 99, 102, 241), 0.7)
        );
        transition: width 0.3s ease;
        border-radius: 4px;
        position: relative;
      }

      .progress-shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.15) 50%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: progressShimmer 1.5s ease-in-out infinite;
      }

      @keyframes progressShimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }

      .upload-progress p {
        font-size: 0.875rem;
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.6);
        margin: 0;
      }

      .error-message {
        padding: 1rem;
        background: rgba(var(--danger, 239, 68, 68), 0.1);
        border: 1px solid rgba(var(--danger, 239, 68, 68), 0.3);
        border-radius: var(--personality-border-radius, 8px);
        color: var(--danger, #ef4444);
        margin-bottom: 1rem;
      }

      .success-message {
        padding: 1rem;
        background: rgba(var(--success, 34, 197, 94), 0.1);
        border: 1px solid rgba(var(--success, 34, 197, 94), 0.3);
        border-radius: var(--personality-border-radius, 8px);
        color: var(--success, #22c55e);
        margin-bottom: 1rem;
      }

      .form-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }

      .btn {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 999px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all var(--animation-duration-fast, 0.15s)
          var(--animation-easing, ease);
      }

      .btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .btn-secondary {
        background: rgba(var(--foreground-rgb, 232, 232, 236), 0.08);
        color: rgba(var(--foreground-rgb, 232, 232, 236), 0.7);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .btn-secondary:hover:not(:disabled) {
        background: rgba(var(--foreground-rgb, 232, 232, 236), 0.14);
      }

      .btn-primary {
        background: linear-gradient(
          135deg,
          var(--accent, #6366f1),
          rgba(var(--accent-rgb, 99, 102, 241), 0.8)
        );
        color: #ffffff;
        box-shadow: 0 4px 16px rgba(var(--accent-rgb, 99, 102, 241), 0.3);
      }

      .btn-primary:hover:not(:disabled) {
        box-shadow: 0 6px 24px rgba(var(--accent-rgb, 99, 102, 241), 0.45);
        transform: translateY(-1px);
      }
    `,
  ],
})
export class UploadComponent {
  videoFile: File | null = null;
  thumbnailFile: File | null = null;
  channels: any[] = [];

  videoData = {
    title: '',
    description: '',
    channelId: '',
    visibility: 'public' as 'public' | 'unlisted' | 'private',
  };

  uploading = false;
  uploadProgress = 0;
  error: string | null = null;
  success = false;

  constructor(
    private http: HttpClient,
    private videoService: VideoService,
    private router: Router,
  ) {
    this.loadChannels();
  }

  loadChannels() {
    // In a real app, this would load user's channels
    this.videoService.getChannels().subscribe({
      next: (channels) => {
        this.channels = channels;
      },
      error: (err) => {
        console.error('Failed to load channels:', err);
      },
    });
  }

  onVideoFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.videoFile = file;
      this.error = null;
    }
  }

  onThumbnailFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.thumbnailFile = file;
    }
  }

  async onSubmit() {
    if (!this.videoFile) {
      this.error = 'Please select a video file';
      return;
    }

    this.uploading = true;
    this.error = null;
    this.uploadProgress = 0;

    try {
      // Step 1: Upload video file to asset service
      this.uploadProgress = 10;
      const videoAssetId = await this.uploadFile(this.videoFile, 'video');

      this.uploadProgress = 50;

      // Step 2: Upload thumbnail if provided
      let thumbnailAssetId: string | undefined;
      if (this.thumbnailFile) {
        thumbnailAssetId = await this.uploadFile(this.thumbnailFile, 'image');
      }

      this.uploadProgress = 70;

      // Step 3: Create video record
      const createVideoDto: CreateVideoDto = {
        title: this.videoData.title,
        description: this.videoData.description,
        assetId: videoAssetId,
        thumbnailAssetId: thumbnailAssetId,
        channelId: this.videoData.channelId,
        visibility: this.videoData.visibility,
      };

      this.videoService.createVideo(createVideoDto).subscribe({
        next: (video) => {
          this.uploadProgress = 100;
          this.success = true;
          this.uploading = false;

          // Redirect to video page after 2 seconds
          setTimeout(() => {
            this.router.navigate(['/watch', video.id]);
          }, 2000);
        },
        error: (err) => {
          this.error = 'Failed to create video record';
          this.uploading = false;
          console.error('Error creating video:', err);
        },
      });
    } catch (err) {
      this.error = 'Failed to upload file';
      this.uploading = false;
      console.error('Upload error:', err);
    }
  }

  private async uploadFile(file: File, type: string): Promise<string> {
    // Convert file to base64
    const base64 = await this.fileToBase64(file);

    // Create asset
    const assetData = {
      name: file.name,
      type: type,
      content: base64.split(',')[1], // Remove data:... prefix
      fileExtension: file.name.split('.').pop(),
      profileId: 'user-profile-id', // Should come from auth service
    };

    return new Promise((resolve, reject) => {
      this.http.post<any>('/api/asset', assetData).subscribe({
        next: (asset) => resolve(asset.id),
        error: (err) => reject(err),
      });
    });
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  onCancel() {
    this.router.navigate(['/']);
  }
}
