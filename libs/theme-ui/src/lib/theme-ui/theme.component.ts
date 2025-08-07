import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
import { ThemeService } from './theme.service';
import { ThemeColors } from './theme.interface';
/**
 * Component for toggling themes and updating accent colors.
 */
@Component({
  selector: 'lib-theme-toggle',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './theme.component.html',
  styleUrl: './theme.component.scss',
  host: {
    '[class.dark]': 'theme === "dark"',
    '[class.light]': 'theme === "light"',
  }
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  /**
   * The current theme (light or dark).
   */
  theme: 'light' | 'dark';
  /**
   * The current accent color.
   */
  accentColor = '#ff4081';
  /**
   * The background color for styling.
   */
  background = '#ffffff';
  /**
   * The foreground color for styling.
   */
  foreground = '#000000';
  /**
   * The accent color for styling.
   */
  accent = '#ff4081';
  /**
   * The complementary color for styling.
   */
  complement = '#00bcd4';
  /**
   * The border color for styling.
   */
  borderColor = '#cccccc';
  /**
   * Subject to signal component destruction for unsubscribing observables.
   */
  destroy$: Subject<boolean> = new Subject<boolean>();
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  /**
   * The duration for CSS transitions.
   */
  transitionDuration = '0.3s';

  /**
   * Creates an instance of ThemeToggleComponent.
   * @param themeService The ThemeService instance.
   */
  constructor(private readonly themeService: ThemeService) {
    this.theme = this.themeService.getTheme();
    this.accentColor = this.themeService.getAccentColor();
  }

  /**
   * Initializes the component and subscribes to theme color changes.
   */
  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter(
          (value) =>
            !!(value?.background && value?.foreground && value?.accent),
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

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    this.destroy$.next(true);
    this.destroy$.complete();
  }

  /**
   * Toggles the current theme between 'light' and 'dark'.
   */
  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(this.theme);
  }

  /**
   * Updates the accent color based on the current value of `accentColor`.
   */
  updateAccentColor() {
    this.themeService.setAccentColor(this.accentColor);
  }
}