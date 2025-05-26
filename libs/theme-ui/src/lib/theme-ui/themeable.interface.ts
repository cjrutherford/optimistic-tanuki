// filepath: libs/common-ui/src/lib/common-ui/themeable.ts
import { Directive, OnDestroy, OnInit } from '@angular/core';
import { ThemeService } from './theme.service';
import { ThemeColors } from './theme.interface';
import { Subject, takeUntil, filter } from 'rxjs';

@Directive()
export abstract class Themeable implements OnInit, OnDestroy {
  theme: 'light' | 'dark' = 'light';
  background = '#ffffff';
  foreground = '#000000';
  accent = '#007bff';
  complement = '#f8f9fa';
  borderColor = '#dee2e6';
  borderGradient = 'linear-gradient(to right, #007bff, #6610f2)';
  transitionDuration = '0.3s';
  protected destroy$ = new Subject<void>();

  constructor(protected readonly themeService: ThemeService) {}

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter(
          (value) =>
            !!(value && value.background && value.foreground && value.accent),
        ),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (colors: ThemeColors | undefined) => {
          if (colors) {
            this.applyTheme(colors);
          }
        },
        error: (err: any) => {
          console.error('Error fetching theme colors:', err);
        },
        complete: () => {
          console.log('Theme colors subscription completed');
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  abstract applyTheme(colors: ThemeColors): void;
}