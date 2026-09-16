import {
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  EnvironmentInjector,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  createComponent,
  inject,
} from '@angular/core';
import { Subject, filter, takeUntil } from 'rxjs';
import { NavigationStart, Router } from '@angular/router';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {
  ThemeService,
  Personality,
  PREDEFINED_PERSONALITIES,
  GeneratedTheme,
} from '@optimistic-tanuki/theme-lib';
import {
  THEME_PERSONALITY_PICKER_LOADER,
  type PersonalityPickerHostContract,
} from './personality-picker-loader';
import {
  AppearanceMenuOverlayComponent,
  type AppearanceMenuOverlayContract,
} from './appearance-menu-overlay.component';
import {
  PersonalityPickerOverlayComponent,
  type PersonalityPickerOverlayContract,
} from './personality-picker-overlay.component';

@Component({
  selector: 'lib-theme-toggle',
  standalone: true,
  imports: [FormsModule, CommonModule],
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
  private static nextControlsId = 0;
  private static nextPersonalityPickerId = 0;
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
  showControls = false;
  readonly controlsId = `appearance-controls-${ThemeToggleComponent.nextControlsId++}`;
  readonly personalityPickerId = `personality-picker-${ThemeToggleComponent.nextPersonalityPickerId++}`;
  readonly personalityPickerTitleId = `${this.personalityPickerId}-title`;
  personalityPickerLoading = false;
  personalityPickerError = false;

  @ViewChild('appearanceTrigger')
  private appearanceTrigger?: ElementRef<HTMLButtonElement>;
  private appearanceMenuRef: ComponentRef<AppearanceMenuOverlayContract> | null =
    null;
  private appearanceMenuHost: HTMLElement | null = null;
  private appearanceMenuScrollListener: (() => void) | null = null;
  private personalityPickerRef: ComponentRef<PersonalityPickerHostContract> | null =
    null;
  private personalityPickerRefDestroy$: Subject<void> | null = null;
  private personalityPickerOverlayRef: ComponentRef<PersonalityPickerOverlayContract> | null =
    null;
  private personalityPickerOverlayHost: HTMLElement | null = null;
  private personalityPickerRequest = 0;
  private isDestroying = false;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly hostElement = inject(ElementRef<HTMLElement>);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly router = inject(Router, { optional: true });
  private readonly personalityPickerLoader = inject(
    THEME_PERSONALITY_PICKER_LOADER
  );

  constructor(private readonly themeService: ThemeService) {
    this.theme = this.themeService.getTheme() || 'light';
    this.accentColor = this.themeService.getAccentColor();
    this.currentPersonality = this.themeService.getCurrentPersonality();
  }

  ngOnInit() {
    this.router?.events
      .pipe(
        filter(
          (event): event is NavigationStart => event instanceof NavigationStart
        ),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.closeControls({ restoreFocus: false }));

    this.themeService
      .theme$()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (theme) => {
          if (theme) {
            this.theme = theme;
            this.syncAppearanceMenuInputs();
          }
        },
      });

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
          this.syncAppearanceMenuInputs();
        },
      });

    // Also subscribe to personality for name updates
    this.themeService.personality$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (personality: Personality | undefined) => {
        if (personality) {
          this.currentPersonality = personality;
          this.syncAppearanceMenuInputs();
        }
      },
    });
  }

  ngOnDestroy() {
    this.isDestroying = true;
    this.destroy$.next(true);
    this.destroy$.complete();
    this.closeControls({ restoreFocus: false });
  }

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    this.themeService.setTheme(this.theme);
    this.syncAppearanceMenuInputs();
  }

  toggleControls() {
    if (this.showControls) {
      this.closeControls();
      return;
    }

    this.showControls = true;
    this.refreshView();
    this.createAppearanceMenuOverlay();
    this.scheduleFocus(() =>
      this.appearanceMenuRef?.instance.focusFirstElement()
    );
  }

  closeControls(options: { restoreFocus?: boolean } = {}) {
    const restoreFocus = options.restoreFocus ?? true;
    const wasOpen = this.showControls;
    this.clearScheduledFocus();
    if (
      this.showPersonalityPicker ||
      this.personalityPickerLoading ||
      this.personalityPickerError
    ) {
      this.closePersonalityPicker({ restoreFocus: false });
    }
    this.destroyAppearanceMenuOverlay();
    this.showControls = false;
    this.refreshView();
    if (wasOpen && restoreFocus) {
      this.scheduleFocus(() => this.focusAppearanceTrigger());
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  handleEscape(event?: Event) {
    if (this.showPersonalityPicker) {
      this.closePersonalityPicker();
      event?.preventDefault();
      return;
    }
    if (this.showControls) {
      this.closeControls();
      event?.preventDefault();
    }
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: MouseEvent) {
    if (
      this.showControls &&
      !this.isInternalOverlayEvent(event) &&
      !this.hostElement.nativeElement.contains(event.target as Node)
    ) {
      this.closeControls();
    }
  }

  updateAccentColor() {
    this.themeService.setPrimaryColor(this.accentColor);
  }

  togglePersonalityPicker() {
    if (this.showPersonalityPicker) {
      this.closePersonalityPicker();
    } else {
      this.openPersonalityPicker();
    }
  }

  private createAppearanceMenuOverlay(): void {
    if (this.appearanceMenuRef || typeof document === 'undefined') {
      return;
    }

    const hostElement = document.createElement('div');
    hostElement.className = 'appearance-menu-overlay-host';
    hostElement.style.position = 'fixed';
    hostElement.style.zIndex = 'var(--z-index-dropdown, 1000)';
    hostElement.style.visibility = 'hidden';
    document.body.appendChild(hostElement);

    const overlayRef = createComponent(AppearanceMenuOverlayComponent, {
      environmentInjector: this.environmentInjector,
      hostElement,
    }) as ComponentRef<AppearanceMenuOverlayContract>;
    overlayRef.instance.controlsId = this.controlsId;
    overlayRef.instance.personalityPickerId = this.personalityPickerId;
    overlayRef.instance.theme = this.theme;
    overlayRef.instance.accentColor = this.accentColor;
    overlayRef.instance.currentPersonality = this.currentPersonality;
    overlayRef.instance.showPersonalityPicker = this.showPersonalityPicker;
    overlayRef.instance.themeToggled
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.toggleTheme());
    overlayRef.instance.accentColorChanged
      .pipe(takeUntil(this.destroy$))
      .subscribe((color) => {
        this.accentColor = color;
        this.updateAccentColor();
        this.syncAppearanceMenuInputs();
      });
    overlayRef.instance.personalityPickerToggled
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.togglePersonalityPicker());
    overlayRef.instance.closed
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closeControls());

    this.applicationRef.attachView(overlayRef.hostView);
    overlayRef.changeDetectorRef.detectChanges();
    this.appearanceMenuRef = overlayRef;
    this.appearanceMenuHost = hostElement;
    this.appearanceMenuScrollListener = () => this.positionAppearanceMenu();
    window.addEventListener('resize', this.appearanceMenuScrollListener, {
      passive: true,
    });
    window.addEventListener('scroll', this.appearanceMenuScrollListener, {
      capture: true,
      passive: true,
    });
    this.positionAppearanceMenu();
    hostElement.style.visibility = 'visible';
  }

  private destroyAppearanceMenuOverlay(): void {
    const overlayRef = this.appearanceMenuRef;
    this.appearanceMenuRef = null;
    if (this.appearanceMenuScrollListener) {
      window.removeEventListener('resize', this.appearanceMenuScrollListener);
      window.removeEventListener(
        'scroll',
        this.appearanceMenuScrollListener,
        true
      );
    }
    this.appearanceMenuScrollListener = null;
    if (overlayRef) {
      this.applicationRef.detachView(overlayRef.hostView);
    }
    overlayRef?.destroy();
    this.appearanceMenuHost?.remove();
    this.appearanceMenuHost = null;
  }

  private positionAppearanceMenu(): void {
    const host = this.appearanceMenuHost;
    const trigger = this.appearanceTrigger?.nativeElement;
    const menu = host?.querySelector<HTMLElement>('.toggle-container');
    if (!host || !trigger || !menu || !trigger.isConnected) {
      return;
    }

    const gutter = 16;
    const triggerRect = trigger.getBoundingClientRect();
    const width = Math.min(352, Math.max(0, window.innerWidth - gutter * 2));
    host.style.width = `${width}px`;
    host.style.maxWidth = `calc(100vw - ${gutter * 2}px)`;
    menu.style.maxHeight = 'none';
    menu.style.overflowY = 'hidden';

    const naturalHeight = menu.getBoundingClientRect().height;
    const belowSpace = Math.max(
      0,
      window.innerHeight - triggerRect.bottom - gutter
    );
    const aboveSpace = Math.max(0, triggerRect.top - gutter);
    const placeBelow = belowSpace >= naturalHeight || belowSpace >= aboveSpace;
    const availableSpace = placeBelow ? belowSpace : aboveSpace;
    const height = Math.min(naturalHeight, availableSpace);
    const top = placeBelow
      ? triggerRect.bottom + 8
      : triggerRect.top - height - 8;
    const left = Math.min(
      Math.max(gutter, triggerRect.left),
      Math.max(gutter, window.innerWidth - width - gutter)
    );

    host.style.left = `${left}px`;
    host.style.top = `${Math.max(gutter, top)}px`;
    menu.style.maxHeight = `${Math.max(0, height)}px`;
    menu.style.overflowY = naturalHeight > height ? 'auto' : 'visible';
  }

  private syncAppearanceMenuInputs(): void {
    const instance = this.appearanceMenuRef?.instance;
    if (!instance) {
      return;
    }
    instance.theme = this.theme;
    instance.accentColor = this.accentColor;
    instance.currentPersonality = this.currentPersonality;
    instance.showPersonalityPicker = this.showPersonalityPicker;
    this.appearanceMenuRef?.changeDetectorRef.detectChanges();
    this.positionAppearanceMenu();
  }

  private isInternalOverlayEvent(event: Event): boolean {
    return event.composedPath().some((target) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      return (
        target.classList.contains('appearance-menu-overlay-host') ||
        target.classList.contains('personality-picker-overlay-host')
      );
    });
  }

  async openPersonalityPicker() {
    if (this.showPersonalityPicker) {
      return;
    }

    const request = ++this.personalityPickerRequest;
    this.showPersonalityPicker = true;
    this.personalityPickerLoading = true;
    this.personalityPickerError = false;
    this.clearScheduledFocus();
    this.refreshView();
    this.syncAppearanceMenuInputs();
    this.createPersonalityPickerOverlay();

    try {
      const pickerType = await this.personalityPickerLoader();
      if (!this.isCurrentPersonalityPickerRequest(request)) {
        return;
      }

      const overlayRef = this.personalityPickerOverlayRef;
      if (!overlayRef) {
        return;
      }

      this.destroyPersonalityPickerRef();
      const componentRef =
        overlayRef.instance.pickerHost.createComponent(pickerType);
      componentRef.instance.personalities = this.personalities;
      componentRef.instance.currentPersonality = this.currentPersonality;
      componentRef.instance.titleId = this.personalityPickerTitleId;
      const refDestroy$ = new Subject<void>();
      componentRef.instance.personalitySelected
        .pipe(takeUntil(this.destroy$), takeUntil(refDestroy$))
        .subscribe((personality) => this.selectPersonality(personality));
      componentRef.instance.closed
        .pipe(takeUntil(this.destroy$), takeUntil(refDestroy$))
        .subscribe(() => this.closePersonalityPicker());

      this.personalityPickerRef = componentRef;
      this.personalityPickerRefDestroy$ = refDestroy$;
      this.personalityPickerLoading = false;
      overlayRef.instance.state = 'ready';
      overlayRef.changeDetectorRef.detectChanges();
      overlayRef.instance.focusFirstElement();
      this.refreshView();
    } catch {
      if (this.isCurrentPersonalityPickerRequest(request)) {
        this.personalityPickerLoading = false;
        this.personalityPickerError = true;
        const overlayRef = this.personalityPickerOverlayRef;
        if (overlayRef) {
          overlayRef.instance.state = 'error';
          overlayRef.changeDetectorRef.detectChanges();
          overlayRef.instance.focusFirstElement();
        }
        this.syncAppearanceMenuInputs();
        this.refreshView();
      }
    }
  }

  closePersonalityPicker(options: { restoreFocus?: boolean } = {}) {
    const restoreFocus = options.restoreFocus ?? true;
    const wasOpen =
      this.showPersonalityPicker ||
      this.personalityPickerLoading ||
      this.personalityPickerError;
    ++this.personalityPickerRequest;
    this.clearScheduledFocus();
    this.destroyPersonalityPickerRef();
    this.destroyPersonalityPickerOverlay();
    this.showPersonalityPicker = false;
    this.personalityPickerLoading = false;
    this.personalityPickerError = false;
    this.syncAppearanceMenuInputs();
    this.refreshView();
    if (wasOpen && restoreFocus) {
      this.scheduleFocus(() => {
        if (this.showControls) {
          this.focusPersonalityTrigger();
        } else {
          this.focusAppearanceTrigger();
        }
      });
    }
  }

  retryPersonalityPicker() {
    this.closePersonalityPicker({ restoreFocus: false });
    void this.openPersonalityPicker();
  }

  selectPersonality(personality: Personality) {
    this.themeService.setPersonality(personality.id);
    this.closePersonalityPicker();
  }

  private isCurrentPersonalityPickerRequest(request: number): boolean {
    return (
      request === this.personalityPickerRequest && this.showPersonalityPicker
    );
  }

  private destroyPersonalityPickerRef(): void {
    const ref = this.personalityPickerRef;
    const refDestroy$ = this.personalityPickerRefDestroy$;
    this.personalityPickerRef = null;
    this.personalityPickerRefDestroy$ = null;
    refDestroy$?.next();
    refDestroy$?.complete();
    ref?.destroy();
  }

  private createPersonalityPickerOverlay(): void {
    const hostElement = document.createElement('div');
    hostElement.className = 'personality-picker-overlay-host';
    document.body.appendChild(hostElement);

    const overlayRef = createComponent(PersonalityPickerOverlayComponent, {
      environmentInjector: this.environmentInjector,
      hostElement,
    }) as ComponentRef<PersonalityPickerOverlayContract>;
    overlayRef.instance.dialogId = this.personalityPickerId;
    overlayRef.instance.titleId = this.personalityPickerTitleId;
    overlayRef.instance.state = 'loading';
    overlayRef.instance.closed
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.closePersonalityPicker());
    overlayRef.instance.retry
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.retryPersonalityPicker());

    this.applicationRef.attachView(overlayRef.hostView);
    overlayRef.changeDetectorRef.detectChanges();
    this.personalityPickerOverlayRef = overlayRef;
    this.personalityPickerOverlayHost = hostElement;
    overlayRef.instance.focusFirstElement();
  }

  private destroyPersonalityPickerOverlay(): void {
    const overlayRef = this.personalityPickerOverlayRef;
    this.personalityPickerOverlayRef = null;
    if (overlayRef) {
      this.applicationRef.detachView(overlayRef.hostView);
    }
    overlayRef?.destroy();
    this.personalityPickerOverlayHost?.remove();
    this.personalityPickerOverlayHost = null;
  }

  private focusPersonalityTrigger(): void {
    const trigger =
      this.appearanceMenuHost?.querySelector<HTMLButtonElement>(
        '.personality-trigger'
      ) ??
      (this.hostElement.nativeElement.querySelector(
        '.personality-trigger'
      ) as HTMLButtonElement | null);
    if (trigger?.isConnected) {
      trigger.focus();
    }
  }

  private focusAppearanceTrigger(): void {
    const trigger =
      this.appearanceTrigger?.nativeElement ??
      (this.hostElement.nativeElement.querySelector(
        '.appearance-trigger'
      ) as HTMLButtonElement | null);
    if (trigger?.isConnected) {
      trigger.focus();
    }
  }

  private refreshView(): void {
    if (!this.isDestroying) {
      this.changeDetectorRef.detectChanges();
    }
  }

  private scheduleFocus(callback: () => void): void {
    this.clearScheduledFocus();
    this.focusTimer = setTimeout(() => {
      this.focusTimer = null;
      callback();
    }, 0);
  }

  private clearScheduledFocus(): void {
    if (this.focusTimer !== null) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
  }
}
