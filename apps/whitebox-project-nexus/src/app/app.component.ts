import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, filter, takeUntil } from 'rxjs';
import { HeaderComponent } from './components/header/header.component';
import {
  ThemeService,
  industrialNexusTheme,
} from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'nexus-root',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('mainContent') mainContent?: ElementRef<HTMLElement>;

  title = 'Project Nexus';

  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly themeService = inject(ThemeService, { optional: true });
  private readonly destroy$ = new Subject<void>();
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    Object.entries(industrialNexusTheme.cssVariables).forEach(
      ([property, value]) => {
        this.renderer.setStyle(this.elementRef.nativeElement, property, value);
      }
    );

    const mode = industrialNexusTheme.mode === 'light' ? 'light' : 'dark';
    this.themeService?.setTheme(mode);
    this.themeService?.applyAppTheme(industrialNexusTheme);
  }

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.focusTimer) {
          clearTimeout(this.focusTimer);
        }
        this.focusTimer = setTimeout(() => {
          this.focusTimer = null;
          this.mainContent?.nativeElement.focus();
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
    }
  }
}
