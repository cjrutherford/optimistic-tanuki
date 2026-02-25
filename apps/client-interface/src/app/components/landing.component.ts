import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();

  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D | null;
  private animationId!: number;
  private particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    opacity: number;
  }> = [];

  private currentAccentColor = '#E07A5F';

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initConstellation();
    this.applyThemeColors();
    this.subscribeToThemeChanges();
  }

  ngOnDestroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToThemeChanges(): void {
    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        if (theme) {
          this.currentAccentColor = theme.colors.primary;
          // Respect personality animation preferences
          if (theme.personality?.animations?.prefersReducedMotion) {
            this.disableAnimations();
          }
        }
      });
  }

  private disableAnimations(): void {
    // Stop canvas animation if reduced motion is preferred
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
    // Add reduced-motion class to body
    document.body.classList.add('reduced-motion');
  }

  private enableAnimations(): void {
    if (!this.animationId && this.canvas) {
      this.animate();
    }
    document.body.classList.remove('reduced-motion');
  }

  private applyThemeColors(): void {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    this.currentAccentColor =
      style.getPropertyValue('--accent').trim() || '#E07A5F';

    if (this.canvas) {
      this.canvas.style.background = 'transparent';
    }
  }

  private initConstellation(): void {
    this.canvas = document.getElementById(
      'constellation-canvas'
    ) as HTMLCanvasElement;
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    if (!this.ctx) return;

    this.resizeCanvas();
    this.createParticles();
    this.animate();

    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private createParticles(): void {
    const particleCount = Math.floor(
      (window.innerWidth * window.innerHeight) / 20000
    );
    this.particles = [];

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.4 + 0.1,
      });
    }
  }

  private animate(): void {
    if (!this.ctx || !this.canvas) return;

    const rgb = this.hexToRgb(this.currentAccentColor);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, i) => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;

      if (rgb) {
        this.ctx!.beginPath();
        this.ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        this.ctx!.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`;
        this.ctx!.fill();

        for (let j = i + 1; j < this.particles.length; j++) {
          const p2 = this.particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            this.ctx!.beginPath();
            this.ctx!.moveTo(p.x, p.y);
            this.ctx!.lineTo(p2.x, p2.y);
            this.ctx!.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${
              0.1 * (1 - dist / 120)
            })`;
            this.ctx!.lineWidth = 1;
            this.ctx!.stroke();
          }
        }
      }
    });

    this.animationId = requestAnimationFrame(() => this.animate());
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }

  scrollToHowItWorks(): void {
    const featuresSection = document.getElementById('how-it-works');
    if (featuresSection) {
      featuresSection.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
