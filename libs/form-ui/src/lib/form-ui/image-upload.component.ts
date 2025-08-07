import { CommonModule } from "@angular/common";
import { Component, OnInit, Output, EventEmitter, Input, HostListener } from "@angular/core";

/**
 * Component for uploading images via file input or drag-and-drop.
 */
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
  /**
   * Emits the base64 encoded string of the uploaded image.
   */
  @Output() imageUpload = new EventEmitter<string>();
  /**
   * The current image URL or base64 string to display.
   */
  @Input() currentImage: string | null = null;
  /**
   * The base64 encoded string of the selected or dropped image.
   */
  image: string | null = null;
  /**
   * Indicates whether a drag operation is currently over the component.
   */
  isDragOver = false;

  /**
   * Handles the change event of the file input.
   * @param event The change event.
   */
  handleImageChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.readFile(file);
    }
  }

  /**
   * Initializes the component.
   */
  ngOnInit(): void {
    if (this.currentImage) {
      this.image = this.currentImage;
    }
  }

  /**
   * Handles the drop event for drag-and-drop functionality.
   * @param event The drag event.
   */
  @HostListener('drop', ['$event'])
  handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file) {
      this.readFile(file);
    }
  }

  /**
   * Handles the dragover event for drag-and-drop functionality.
   * @param event The drag event.
   */
  @HostListener('dragover', ['$event'])
  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = true;
  }

  /**
   * Handles the dragleave event for drag-and-drop functionality.
   * @param event The drag event.
   */
  @HostListener('dragleave', ['$event'])
  handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver = false;
  }

  /**
   * Reads the content of a file and converts it to a base64 string.
   * @param file The file to read.
   */
  private readFile(file: File): void {
    const reader = new FileReader();
    reader.onloadend = () => {
      this.image = reader.result as string;
      this.imageUpload.emit(this.image);
    };
    reader.readAsDataURL(file);
  }
}
