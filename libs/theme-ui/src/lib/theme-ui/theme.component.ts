import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from './theme.service';
import { FormsModule } from '@angular/forms';
import { Observable, Subject, Subscription, filter, takeUntil } from 'rxjs';
import { ThemeColors } from './theme.interface';

@Component({
  selector: 'lib-theme-toggle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme.component.html',
  styleUrl: './theme.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--border-color]': 'borderColor',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--accent-color]': 'accent',
    '[style.--complementary-color]': 'complement',
    '[class.dark]': 'theme === "dark"',
    '[class.light]': 'theme === "light"',
  }
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  theme: 'light' | 'dark';
  accentColor = '#ff4081';
  background = '#ffffff';
  foreground = '#000000';
  accent = '#ff4081';
  complement = '#00bcd4';
  borderColor = '#cccccc';
  destroy$: Subject<boolean> = new Subject<boolean>();
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  transitionDuration: string = '0.3s';

  constructor(private themeService: ThemeService) {
    this.theme = this.themeService.getTheme();
    this.accentColor = this.themeService.getAccentColor();
  }

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
          if (!colors) {
            return;
          }
          this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.accent})`;
          this.foreground = colors.foreground;
          this.accent = colors.accent;
          this.complement = colors.complementary;
          if (this.theme === 'dark') {
            this.borderColor = colors.complementaryShades[6][1];
          } else {
            this.borderColor = colors.complementaryShades[3][1];
          }
        },
      });
  }

  ngOnDestroy() {
    this.destroy$.next(true);
    this.destroy$.complete();
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(this.theme);
  }

  updateAccentColor() {
    this.themeService.setAccentColor(this.accentColor);
  }
}