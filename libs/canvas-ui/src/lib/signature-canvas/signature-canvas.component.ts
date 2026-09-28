import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'nxui-signature-canvas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="signature-shell">
      <canvas
        #canvas
        class="signature-canvas"
        [attr.width]="pixelWidth"
        [attr.height]="pixelHeight"
        [attr.aria-label]="ariaLabel"
        role="img"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (pointerleave)="onPointerUp($event)"
      ></canvas>
      <div class="signature-actions">
        <span
          *ngIf="signed"
          class="signature-state"
          role="status"
          aria-live="polite"
          >Signature captured</span
        >
        <button
          type="button"
          class="btn-clear"
          (click)="clear()"
          [disabled]="!signed || disabled"
        >
          Clear
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .signature-shell {
        border: 1px solid var(--border-strong);
        border-radius: 8px;
        background: var(--input-bg);
        padding: 8px;
      }
      .signature-canvas {
        display: block;
        width: 100%;
        height: 160px;
        border-radius: 4px;
        background: repeating-linear-gradient(
            transparent,
            transparent 39px,
            color-mix(in srgb, var(--foreground-muted) 25%, transparent) 40px
          ),
          var(--background);
        touch-action: none;
        cursor: crosshair;
      }
      .signature-canvas:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .signature-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 8px;
      }
      .signature-state {
        font-size: 0.8rem;
        color: var(--trust-badge-color);
      }
      .btn-clear {
        background: transparent;
        border: 1px solid var(--border-color);
        color: var(--foreground-secondary);
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 0.8rem;
        cursor: pointer;
      }
      .btn-clear:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class SignatureCanvasComponent implements AfterViewInit, OnChanges {
  @Input() ariaLabel = 'Signature pad. Draw your signature with a pointer.';
  @Input() disabled = false;
  @Input() strokeWidth = 2.5;
  @Output() readonly signedChange = new EventEmitter<string | null>();

  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  pixelWidth = 600;
  pixelHeight = 160;
  signed = false;

  private drawing = false;
  private lastPoint: { x: number; y: number } | null = null;
  private context: CanvasRenderingContext2D | null = null;

  ngAfterViewInit(): void {
    this.resize();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['strokeWidth'] && this.context) {
      this.context.lineWidth = this.strokeWidth;
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (this.disabled) {
      return;
    }
    event.preventDefault();
    this.ensureContext();
    this.drawing = true;
    this.lastPoint = this.toCanvasPoint(event);
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.drawing || this.disabled || !this.context || !this.lastPoint) {
      return;
    }
    event.preventDefault();
    const point = this.toCanvasPoint(event);
    const context = this.context;
    context.beginPath();
    context.moveTo(this.lastPoint.x, this.lastPoint.y);
    context.quadraticCurveTo(
      this.lastPoint.x,
      this.lastPoint.y,
      (this.lastPoint.x + point.x) / 2,
      (this.lastPoint.y + point.y) / 2
    );
    context.stroke();
    this.lastPoint = point;
    if (!this.signed) {
      this.signed = true;
      this.signedChange.emit(this.toDataUrl());
    }
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.drawing) {
      return;
    }
    event.preventDefault();
    this.drawing = false;
    this.lastPoint = null;
    if (this.signed) {
      this.signedChange.emit(this.toDataUrl());
    }
  }

  clear(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.restore();
    this.signed = false;
    this.signedChange.emit(null);
  }

  toDataUrl(): string | null {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || !this.signed) {
      return null;
    }
    try {
      return canvas.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  private ensureContext(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    this.context = context;
    context.setTransform(this.deviceRatio(), 0, 0, this.deviceRatio(), 0, 0);
    context.lineWidth = this.strokeWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    const stroke = getComputedStyle(canvas).getPropertyValue('--accent').trim();
    context.strokeStyle = stroke || '#fbbf24';
  }

  private resize(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }
    const ratio = this.deviceRatio();
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = 160;
    this.pixelWidth = Math.floor(cssWidth * ratio);
    this.pixelHeight = Math.floor(cssHeight * ratio);
    this.context = null;
  }

  private toCanvasPoint(event: PointerEvent): { x: number; y: number } {
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private deviceRatio(): number {
    if (typeof window === 'undefined' || !window.devicePixelRatio) {
      return 1;
    }
    return Math.min(window.devicePixelRatio, 3);
  }
}
