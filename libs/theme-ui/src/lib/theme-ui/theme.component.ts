import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, Subscription, filter, takeUntil } from 'rxjs';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ThemeColors,
  ThemeService,
  Personality,
  PREDEFINED_PERSONALITIES,
  GeneratedTheme,
} from '@optimistic-tanuki/theme-lib';
import { ModalComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-theme-toggle',
  standalone: true,
  imports: [FormsModule, CommonModule, ModalComponent],
  templateUrl: './theme.component.html',
  styleUrl: './theme.component.scss',
  host: {
    // Using standardized variable names from personality system
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--primary]': 'accent',
    '[style.--secondary]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--transition-duration]': 'transitionDuration',
    '[style.--font-heading]': 'fontHeading',
    '[style.--font-body]': 'fontBody',
    '[style.--font-mono]': 'fontMono',
    '[style.--animation-easing]': 'animationEasing',
    '[style.--animation-duration-fast]': 'animationDurationFast',
    '[style.--animation-duration-normal]': 'animationDurationNormal',
    '[class.dark]': 'theme === "dark"',
    '[class.light]': 'theme === "light"',
  },
})
export class ThemeToggleComponent implements OnInit, OnDestroy {
  theme: 'light' | 'dark';
  accentColor = '#ff4081';
  background = 'var(--background, #ffffff)';
  foreground = 'var(--foreground, #000000)';
  accent = 'var(--primary, #3f51b5)';
  complement = 'var(--secondary, #c0af4b)';
  borderColor = 'var(--border, #cccccc)';
  destroy$: Subject<boolean> = new Subject<boolean>();
  transitionDuration = 'var(--animation-duration-normal, 300ms)';
  animationEasing = 'var(--animation-easing, cubic-bezier(0.4, 0, 0.2, 1))';
  animationDurationFast = 'var(--animation-duration-fast, 150ms)';
  animationDurationNormal = 'var(--animation-duration-normal, 300ms)';
  fontHeading = 'var(--font-heading, system-ui)';
  fontBody = 'var(--font-body, system-ui)';
  fontMono = 'var(--font-mono, monospace)';

  // Personality selection
  personalities = PREDEFINED_PERSONALITIES;
  currentPersonality: Personality | null = null;
  showPersonalityPicker = false;

  constructor(private readonly themeService: ThemeService) {
    this.theme = this.themeService.getTheme();
    this.accentColor = this.themeService.getAccentColor();
    this.currentPersonality = this.themeService.getCurrentPersonality();
  }

  ngOnInit() {
    // Subscribe to generated theme for personality-driven CSS variables
    this.themeService.generatedTheme$
      .pipe(
        filter((value) => !!value),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (generatedTheme: GeneratedTheme | undefined) => {
          if (!generatedTheme) {
            return;
          }
          const colors = generatedTheme.colors;
          this.background = `linear-gradient(to bottom, ${colors.background}, ${colors.primary})`;
          this.foreground = colors.foreground;
          this.accent = colors.primary;
          this.complement = colors.secondary;
          this.borderColor = colors.border;

          // Update font variables from personality
          if (generatedTheme.fonts.heading) {
            this.fontHeading = generatedTheme.fonts.heading.family;
          }
          if (generatedTheme.fonts.body) {
            this.fontBody = generatedTheme.fonts.body.family;
          }
          if (generatedTheme.fonts.mono) {
            this.fontMono = generatedTheme.fonts.mono.family;
          }

          // Update animation variables from personality
          this.animationEasing = generatedTheme.personality.animations.easing;
          this.animationDurationFast =
            generatedTheme.personality.animations.duration.fast;
          this.animationDurationNormal =
            generatedTheme.personality.animations.duration.normal;
        },
      });

    // Also subscribe to personality for name updates
    this.themeService.personality$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (personality: Personality | undefined) => {
        if (personality) {
          this.currentPersonality = personality;
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
    this.themeService.setPrimaryColor(this.accentColor);
  }

  togglePersonalityPicker() {
    this.showPersonalityPicker = !this.showPersonalityPicker;
  }

  closePersonalityPicker() {
    this.showPersonalityPicker = false;
  }

  selectPersonality(personality: Personality) {
    this.themeService.setPersonality(personality.id);
    this.showPersonalityPicker = false;
  }

  getPersonalityCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      professional: 'Professional',
      creative: 'Creative',
      casual: 'Casual',
      technical: 'Technical',
    };
    return labels[category] || category;
  }

  getGroupedPersonalities(): {
    category: string;
    personalities: Personality[];
  }[] {
    const groups: Record<string, Personality[]> = {};
    for (const p of this.personalities) {
      if (!groups[p.category]) {
        groups[p.category] = [];
      }
      groups[p.category].push(p);
    }
    return Object.entries(groups).map(([category, personalities]) => ({
      category,
      personalities,
    }));
  }
}
