import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';

interface Bird {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Palette {
  lead: string;
  flock: string;
}

/**
 * Flock field — replaced the retired three.js `otui-murmuration-scene`.
 *
 * A real flock (separation, alignment, cohesion) on a Canvas 2D surface
 * instead of a three.js point cloud pulled toward its centroid:
 * - reads colours from the theme and RE-reads them when ThemeService changes
 *   the root's style or mode (the three.js scene keeps its first palette);
 * - scales speed/intensity by the personality scene contract
 *   (--scene-tempo, --scene-energy);
 * - pauses offscreen and in hidden tabs, caps DPR at 2, runs outside Angular;
 * - reduced motion renders one composed still frame instead of nothing.
 * Same inputs as the other scenes, plus an optional explicit `count`.
 */
@Component({
  selector: 'otui-flock-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './flock-field.component.html',
  styleUrl: './flock-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlockFieldComponent implements AfterViewInit, OnDestroy {
  @Input() height = '20rem';
  @Input() density = 5;
  /** Explicit bird count; overrides `density`. */
  @Input() count?: number;
  @Input() speed = 1;
  @Input() intensity = 0.7;
  @Input() reducedMotion = false;

  @ViewChild('canvas', { static: true })
  private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);
  private readonly host = inject(ElementRef<HTMLElement>);

  private birds: Bird[] = [];
  private palette: Palette = { lead: 'currentColor', flock: 'currentColor' };
  /** Scene contract multipliers, cached: read on start and on theme change, never per frame. */
  private tokens = { tempo: 1, energy: 1 };
  private frame?: number;
  private visible = true;
  private width = 0;
  private heightPx = 0;
  private cleanup: Array<() => void> = [];

  ngAfterViewInit(): void {
    const canvas = this.canvasRef?.nativeElement;
    // No 2D context (SSR, jsdom): keep the CSS sky as the still frame.
    if (!isPlatformBrowser(this.platformId) || !canvas?.getContext?.('2d'))
      return;
    const reduce =
      this.reducedMotion ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    this.zone.runOutsideAngular(() => {
      this.resize();
      this.readPalette();
      this.seed();
      if (reduce) {
        // A composed still: settle the flock for a moment, then draw once.
        for (let i = 0; i < 180; i++) this.step();
        this.draw();
        return;
      }
      this.watch();
      this.loop();
    });
  }

  ngOnDestroy(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.cleanup.forEach((fn) => fn());
  }

  private get birdCount(): number {
    const fromDensity =
      60 + Math.min(Math.max(Math.round(this.density), 1), 10) * 20;
    return Math.min(Math.max(Math.round(this.count ?? fromDensity), 20), 260);
  }

  /**
   * Reads theme colours and the scene contract (--scene-tempo, --scene-energy;
   * default 1) in ONE computed-style pass. Called on start and when the theme
   * changes, never per frame (getComputedStyle forces a style recalc).
   */
  private readPalette(): void {
    const style = getComputedStyle(this.host.nativeElement);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    const num = (name: string) => parseFloat(style.getPropertyValue(name)) || 1;
    this.palette = {
      lead: read('--primary', '#3f51b5'),
      flock: read('--tertiary', read('--secondary', '#607d8b')),
    };
    this.tokens = {
      tempo: num('--scene-tempo'),
      energy: num('--scene-energy'),
    };
  }

  private watch(): void {
    const canvas = this.canvasRef!.nativeElement;
    if (typeof ResizeObserver !== 'undefined') {
      const resize = new ResizeObserver(() => this.resize());
      resize.observe(canvas.parentElement ?? canvas);
      this.cleanup.push(() => resize.disconnect());
    }

    // ThemeService writes variables inline on <html> and sets data-mode.
    const theme = new MutationObserver(() => this.readPalette());
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'data-mode', 'data-theme'],
    });
    this.cleanup.push(() => theme.disconnect());

    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([entry]) => {
        this.visible = entry.isIntersecting;
        if (this.visible && !this.frame) this.loop();
      });
      io.observe(canvas);
      this.cleanup.push(() => io.disconnect());
    }

    const onVisibility = () => {
      if (!document.hidden && this.visible && !this.frame) this.loop();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanup.push(() =>
      document.removeEventListener('visibilitychange', onVisibility)
    );
  }

  private resize(): void {
    const canvas = this.canvasRef!.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = Math.max(1, rect.width);
    this.heightPx = Math.max(1, rect.height);
    canvas.width = Math.round(this.width * dpr);
    canvas.height = Math.round(this.heightPx * dpr);
    canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private seed(): void {
    let s = 4099;
    const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
    this.birds = Array.from({ length: this.birdCount }, () => {
      const angle = rand() * Math.PI * 2;
      return {
        x: this.width * (0.3 + rand() * 0.4),
        y: this.heightPx * (0.3 + rand() * 0.4),
        vx: Math.cos(angle),
        vy: Math.sin(angle),
      };
    });
  }

  private loop = (): void => {
    this.frame = undefined;
    if (!this.visible || document.hidden) return;
    this.step();
    this.draw();
    this.frame = requestAnimationFrame(this.loop);
  };

  /** One boids step: separation, alignment, cohesion, soft walls. */
  private step(): void {
    const { tempo } = this.tokens;
    const maxSpeed = 2.2 * Math.max(this.speed, 0.05) * tempo;
    const view = 38;
    const personal = 12;
    const margin = 40;
    for (const b of this.birds) {
      let ax = 0,
        ay = 0,
        cx = 0,
        cy = 0,
        sx = 0,
        sy = 0,
        n = 0;
      for (const o of this.birds) {
        if (o === b) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > view * view) continue;
        n++;
        ax += o.vx;
        ay += o.vy;
        cx += o.x;
        cy += o.y;
        if (d2 < personal * personal) {
          sx -= dx / (d2 || 1);
          sy -= dy / (d2 || 1);
        }
      }
      if (n) {
        b.vx += (ax / n - b.vx) * 0.05 + (cx / n - b.x) * 0.0009 + sx * 1.4;
        b.vy += (ay / n - b.vy) * 0.05 + (cy / n - b.y) * 0.0009 + sy * 1.4;
      }
      if (b.x < margin) b.vx += 0.08;
      if (b.x > this.width - margin) b.vx -= 0.08;
      if (b.y < margin) b.vy += 0.08;
      if (b.y > this.heightPx - margin) b.vy -= 0.08;
      const speed = Math.hypot(b.vx, b.vy) || 1;
      const limit = Math.min(maxSpeed, Math.max(maxSpeed * 0.55, speed));
      b.vx = (b.vx / speed) * limit;
      b.vy = (b.vy / speed) * limit;
      b.x += b.vx;
      b.y += b.vy;
    }
  }

  private draw(): void {
    const ctx = this.canvasRef?.nativeElement.getContext('2d');
    if (!ctx) return;
    const { energy } = this.tokens;
    const alpha = Math.min(1, Math.max(0.35, this.intensity * energy * 1.3));
    // Fade the previous frame instead of clearing it: short motion trails,
    // the streaks that make a murmuration read as one moving body.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, this.width, this.heightPx);
    ctx.restore();
    this.birds.forEach((b, index) => {
      const lead = index % 7 === 0;
      const angle = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.globalAlpha = alpha * (lead ? 1 : 0.7);
      ctx.fillStyle = lead ? this.palette.lead : this.palette.flock;
      ctx.beginPath();
      ctx.moveTo(8.5, 0);
      ctx.lineTo(-5.5, 3.9);
      ctx.lineTo(-2.4, 0);
      ctx.lineTo(-5.5, -3.9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }
}
