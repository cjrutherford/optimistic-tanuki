import { Component, AfterViewInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { MurmurationSceneComponent } from '@optimistic-tanuki/motion-ui';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, MurmurationSceneComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements AfterViewInit, OnDestroy {
  private router = inject(Router);
  private themeService = inject(ThemeService);
  private destroy$ = new Subject<void>();

  heroGradient = '';
  buttonGradient = '';
  accentColor = '';
  secondaryColor = '';

  features = [
    {
      icon: '⚡',
      title: 'Lightning Fast',
      description:
        'Get things done quickly with our optimized workflow tools that respond instantly to your will.',
    },
    {
      icon: '🎯',
      title: 'Goal Focused',
      description:
        'Set objectives and track progress with precision. Every milestone is a forge triumph.',
    },
    {
      icon: '🤖',
      title: 'AI Powered',
      description:
        'Intelligent assistance that adapts to your needs, like having a master smith at your side.',
    },
    {
      icon: '📊',
      title: 'Data Driven',
      description:
        'Make informed decisions with powerful analytics that reveal the patterns in your work.',
    },
    {
      icon: '👥',
      title: 'Team Ready',
      description:
        'Collaborate seamlessly with your entire team. Many hands make light work.',
    },
    {
      icon: '🔒',
      title: 'Secure & Reliable',
      description:
        'Your data is protected with enterprise-grade security. Guarded like treasure.',
    },
  ];

  stats = [
    { value: '10K+', label: 'Active Smiths' },
    { value: '50M+', label: 'Tasks Forged' },
    { value: '99.9%', label: 'Uptime' },
    { value: '4.9★', label: 'Rating' },
  ];

  ngAfterViewInit() {
    this.updateGradients();
    this.subscribeToThemeChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToThemeChanges(): void {
    this.themeService.generatedTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe((theme) => {
        if (theme) {
          this.updateGradients();
        }
      });
  }

  private updateGradients(): void {
    this.heroGradient = this.themeService.getHeaderGradient();
    this.buttonGradient = this.themeService.getButtonGradient('primary');

    const theme = this.themeService['generatedTheme'].getValue();
    if (theme) {
      this.accentColor = theme.colors.primary;
      this.secondaryColor = theme.colors.secondary;
    } else {
      this.accentColor = '#ff6b35';
      this.secondaryColor = '#00d4ff';
    }
  }

  navigateToLogin(): void {
    this.router.navigate(['/login']);
  }

  navigateToRegister(): void {
    this.router.navigate(['/register']);
  }
}
