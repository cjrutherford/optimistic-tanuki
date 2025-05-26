import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, HostListener, Input, OnInit } from '@angular/core';

@Component({
  selector: 'lib-image-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="upload-container" [class.dragover]="isDragOver">
      <input type="file" accept="image/*" (change)="handleImageChange($event)" />
      <div class="drop-target" (drop)="handleDrop($event)" (dragover)="handleDragOver($event)" (dragleave)="handleDragLeave($event)">
        <p>Drag and drop an image here, or click to select one</p>
      </div>
      <img *ngIf="image" [src]="image" alt="Image preview" class="image-preview" />
    </div>
  `,
  styles: [`
    .upload-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      border: 2px dashed #ccc;
      padding: 1rem;
      position: relative;
    }
    .upload-container.dragover {
      border-color: #000;
    }
    .drop-target {
      width: 100%;
      height: 150px;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      cursor: pointer;
    }
    .image-preview {
      max-width: 300px;
     margin-top: 1rem;
    }
  `]
})
export class ImageUploadComponent implements OnInit {
  @Output() imageUpload = new EventEmitter<string>();
  @Input() currentImage: string | null = null;
  image: string | null = null;
  isDragOver = false;

  handleImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  ngOnInit(): void {
    if (this.currentImage) {
      this.image = this.currentImage;
    }
  }

  @HostListener('drop', ['$event'])
  handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.readFile(file);
    }
  }

  @HostListener('dragover', ['$event'])
  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  @HostListener('dragleave', ['$event'])
  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.image = reader.result as string;
      this.imageUpload.emit(this.image);
    };
    reader.readAsDataURL(file);
  }
}
