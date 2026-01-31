import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VideoService, CreateVideoDto } from '../../services/video.service';

@Component({
  selector: 'video-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="upload-page">
      <div class="upload-container">
        <h1>Upload Video</h1>

        <form (ngSubmit)="onSubmit()" #uploadForm="ngForm">
          <!-- Video File -->
          <div class="form-group">
            <label for="videoFile">Video File *</label>
            <input
              type="file"
              id="videoFile"
              accept="video/*"
              (change)="onVideoFileSelected($event)"
              required
            />
            <small class="form-hint">Supported: MP4, WebM, MOV (Max 500MB)</small>
          </div>

          <!-- Thumbnail -->
          <div class="form-group">
            <label for="thumbnailFile">Thumbnail (Optional)</label>
            <input
              type="file"
              id="thumbnailFile"
              accept="image/*"
              (change)="onThumbnailFileSelected($event)"
            />
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
            <div class="progress-bar">
              <div
                class="progress-fill"
                [style.width.%]="uploadProgress"
              ></div>
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
  styles: [`
    .upload-page {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .upload-container {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin: 0 0 2rem 0;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-weight: 500;
      margin-bottom: 0.5rem;
      color: #030303;
    }

    input[type="text"],
    textarea,
    select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      font-size: 1rem;
      font-family: inherit;
    }

    input[type="file"] {
      width: 100%;
      padding: 0.5rem 0;
    }

    textarea {
      resize: vertical;
      min-height: 100px;
    }

    .form-hint {
      display: block;
      margin-top: 0.25rem;
      font-size: 0.875rem;
      color: #606060;
    }

    .upload-progress {
      margin: 1.5rem 0;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 0.5rem;
    }

    .progress-fill {
      height: 100%;
      background: #1976d2;
      transition: width 0.3s ease;
    }

    .upload-progress p {
      font-size: 0.875rem;
      color: #606060;
      margin: 0;
    }

    .error-message {
      padding: 1rem;
      background: #ffebee;
      border: 1px solid #ef5350;
      border-radius: 4px;
      color: #c62828;
      margin-bottom: 1rem;
    }

    .success-message {
      padding: 1rem;
      background: #e8f5e9;
      border: 1px solid #66bb6a;
      border-radius: 4px;
      color: #2e7d32;
      margin-bottom: 1rem;
    }

    .form-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
      margin-top: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid #e0e0e0;
    }

    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #606060;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e0e0e0;
    }

    .btn-primary {
      background: #1976d2;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #1565c0;
    }
  `]
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
    private router: Router
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
      if (file.size > 500 * 1024 * 1024) {
        this.error = 'Video file is too large. Maximum size is 500MB.';
        return;
      }
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
