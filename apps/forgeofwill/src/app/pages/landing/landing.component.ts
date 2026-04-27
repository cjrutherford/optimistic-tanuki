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
      icon: '🧭',
      title: 'Plan with direction',
      description:
        'Keep projects, tasks, and next actions in one workspace so priorities stay visible.',
    },
    {
      icon: '🔥',
      title: 'Execute in rhythm',
      description:
        'Move from backlog to active work with timers, notes, and decision points built into the flow.',
    },
    {
      icon: '🛡️',
      title: 'Track risk before drift',
      description:
        'Capture blockers, tradeoffs, and course corrections before momentum turns into rework.',
    },
    {
      icon: '📓',
      title: 'Keep the work legible',
      description:
        'Journal context, decisions, and outcomes so the team can understand why the work moved.',
    },
    {
      icon: '🤖',
      title: 'Use AI where it helps',
      description:
        'Bring in assistance for drafting, planning, and analysis without letting the workflow disappear into chat.',
    },
    {
      icon: '⚒️',
      title: 'Ship with intent',
      description:
        'Turn scattered effort into visible progress with a system that keeps the whole craft in view.',
    },
  ];

  stats = [
    { value: 'Plan', label: 'Projects and priorities stay visible' },
    { value: 'Work', label: 'Tasks, notes, and timers stay connected' },
    { value: 'Adapt', label: 'Risks and changes stay reviewable' },
    { value: 'Ship', label: 'Progress stays clear enough to finish' },
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
