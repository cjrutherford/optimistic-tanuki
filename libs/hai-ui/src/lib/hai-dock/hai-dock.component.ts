import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  PLATFORM_ID,
  ViewEncapsulation,
  afterEveryRender,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IconComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutModalComponent } from '../hai-about-modal/hai-about-modal.component';
import { HaiLogoComponent } from '../hai-logo/hai-logo.component';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import {
  HaiResolvedAppLink,
  resolveHaiAppLinks,
} from '../hai-types/hai-app.directory';
import { HaiDockItemComponent } from './hai-dock-item.component';
import { HaiDockShortcutStore } from './hai-dock-shortcut.store';

const CONTROL_SELECTOR = '.hai-dock-item__control';

/**
 * A Mac-style dock for the foot of an app: a bottom-centre pill on wide
 * screens, a full-width tab-bar style strip on phones.
 *
 * Contents, left to right: the built-in About item (the HAI logo, opens the
 * About modal), anything projected into the dock, the visitor's pinned HAI
 * app shortcuts, then an "Add shortcut" item that opens a picker.
 *
 * Project more launchers as `<hai-dock-item>` children; see that component.
 *
 * Accessibility: the dock is a `role="toolbar"`, not a `nav`. Its items are a
 * mix of buttons (About, Add shortcut, anything projected) and links (the
 * shortcuts), and the toolbar pattern is what gives it one tab stop with
 * arrow-key roving between items, which suits a row of launchers. The page
 * keeps its navigation landmark (the site header and footer); the dock is a
 * set of tools, not a site map.
 *
 * Reserved space: while a dock is on the page it publishes
 * `--hai-dock-reserved-block-size` on `:root` (a pure-CSS value that already
 * includes the phone safe area, so server-rendered pages need no JavaScript to
 * get it right). Give the page `padding-block-end: var(--hai-dock-reserved-block-size, 0px)`.
 */
@Component({
  selector: 'hai-dock',
  standalone: true,
  imports: [
    HaiDockItemComponent,
    HaiLogoComponent,
    HaiAboutModalComponent,
    IconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The reserved-space tokens live on `:root`, outside this component, so its
  // stylesheet must not be scoped. Every selector in it is `hai-dock`-prefixed.
  encapsulation: ViewEncapsulation.None,
  host: { '(document:pointerdown)': 'onDocumentPointerdown($event)' },
  templateUrl: './hai-dock.component.html',
  styleUrl: './hai-dock.component.scss',
})
export class HaiDockComponent {
  /** The current app: names the About modal and is left out of the picker. */
  readonly config = input.required<HaiAboutConfig>();
  /** Accessible name of the toolbar. */
  readonly ariaLabel = input('App dock');
  /** Set false to hide pinned shortcuts and the "Add shortcut" item. */
  readonly shortcuts = input(true);

  private readonly store = inject(HaiDockShortcutStore);
  private readonly directory = inject(HaiAppDirectoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injectorRef = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly addItem = viewChild<HaiDockItemComponent>('addItem');
  private readonly aboutItem = viewChild<HaiDockItemComponent>('aboutItem');
  private readonly picker = viewChild<ElementRef<HTMLElement>>('picker');

  readonly aboutOpen = signal(false);
  readonly pickerOpen = signal(false);
  /** Said to screen readers when a shortcut is added or removed. */
  readonly announcement = signal('');

  private readonly pinnedIds = signal<string[]>([]);
  private readonly apps = signal<HaiResolvedAppLink[]>([]);
  private appsRequested = false;
  private tabStop: HTMLElement | null = null;

  /**
   * Apps a visitor can pin: not this app, and published by the registry with
   * a running URL. A repository link is not somewhere a shortcut should go.
   */
  readonly pinnable = computed(() =>
    this.apps().filter(
      (app) => !!app.runUrl && !this.isCurrent(app.appId, app.configName)
    )
  );

  /**
   * Pinned apps that are still reachable, in pin order. Unknown ids, and apps
   * the registry no longer publishes, are skipped but stay stored.
   */
  readonly pinned = computed(() => {
    const pinnable = this.pinnable();
    return this.pinnedIds().flatMap((id) => {
      const app = pinnable.find((candidate) => candidate.appId === id);
      return app ? [app] : [];
    });
  });

  constructor() {
    // Pins live in the browser, so they are read after the first render: the
    // server and the hydrating client both draw the dock without them.
    afterNextRender(() => {
      this.store
        .observe()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((ids) => {
          this.pinnedIds.set(ids);
          if (ids.length) this.loadApps();
        });
    });

    // Keep exactly one item in the tab order (roving tabindex), whatever is
    // projected or pinned at the moment.
    afterEveryRender(() => this.syncTabStops());
  }

  isPinned(app: HaiResolvedAppLink): boolean {
    return this.pinnedIds().includes(app.appId);
  }

  openAbout(): void {
    this.aboutOpen.set(true);
  }

  closeAbout(): void {
    this.aboutOpen.set(false);
    this.aboutItem()?.focus();
  }

  togglePicker(): void {
    if (this.pickerOpen()) {
      this.closePicker();
      return;
    }
    this.loadApps();
    this.pickerOpen.set(true);
    // The picker is rendered on the next change detection pass.
    afterNextRender(
      () => {
        const picker = this.picker()?.nativeElement;
        // The first thing to act on, not the close button above it.
        (
          picker?.querySelector<HTMLElement>('.hai-dock__picker-pin') ??
          picker?.querySelector<HTMLElement>('button')
        )?.focus();
      },
      { injector: this.injectorRef }
    );
  }

  /** Closes the picker; `restoreFocus` returns focus to the Add item. */
  closePicker(restoreFocus = true): void {
    if (!this.pickerOpen()) return;
    this.pickerOpen.set(false);
    if (restoreFocus) this.addItem()?.focus();
  }

  togglePin(app: HaiResolvedAppLink): void {
    if (this.isPinned(app)) {
      this.unpin(app.appId, app.name);
    } else {
      this.store.set([...this.pinnedIds(), app.appId]);
      this.announcement.set(`${app.name} added to the dock.`);
    }
  }

  /** Removes a shortcut from the dock; focus moves to the Add item. */
  unpin(appId: string, name: string): void {
    this.store.set(this.pinnedIds().filter((id) => id !== appId));
    this.announcement.set(`${name} removed from the dock.`);
    if (!this.pickerOpen()) {
      // The removed item is destroyed on the next render; focus a stable one.
      afterNextRender(() => this.addItem()?.focus(), {
        injector: this.injectorRef,
      });
    }
  }

  protected onPickerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closePicker();
    }
  }

  /** Tabbing out of the picker closes it without stealing focus back. */
  protected onPickerFocusout(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const picker = this.picker()?.nativeElement;
    if (!next || !picker || picker.contains(next)) return;
    // Moving to the Add item: its own click toggles the picker.
    if ((next as HTMLElement).closest?.('[data-dock-add]')) return;
    this.closePicker(false);
  }

  /** A press outside the dock closes the picker. */
  protected onDocumentPointerdown(event: Event): void {
    if (
      this.pickerOpen() &&
      !this.host.nativeElement.contains(event.target as Node)
    ) {
      this.closePicker(false);
    }
  }

  protected onToolbarKeydown(event: KeyboardEvent): void {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const controls = this.controls();
    const current = controls.findIndex((control) =>
      control.contains(event.target as Node)
    );
    if (current < 0) return;
    const last = controls.length - 1;
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
        ? last
        : event.key === 'ArrowRight'
        ? Math.min(current + 1, last)
        : Math.max(current - 1, 0);
    event.preventDefault();
    controls[next].focus();
  }

  protected onToolbarFocusin(event: FocusEvent): void {
    const control = (event.target as HTMLElement).closest<HTMLElement>(
      CONTROL_SELECTOR
    );
    if (control && control !== this.tabStop) {
      this.tabStop = control;
      this.syncTabStops();
    }
  }

  /** The host a shortcut opens, shown under its name in the picker. */
  hostOf(url: string | undefined): string {
    return url ? new URL(url).host : '';
  }

  private isCurrent(appId: string, configName: string): boolean {
    const current = this.config().appId;
    return appId === current || configName === current;
  }

  /** Asks the registry for app icons and links; the directory is the fallback. */
  private loadApps(): void {
    if (!this.isBrowser || this.appsRequested) return;
    this.appsRequested = true;
    // Resolved straight from the directory first, so pins and the picker work
    // before (and without) the registry; the registry then adds icons and
    // running-app links.
    this.apps.set(resolveHaiAppLinks([], this.config().appId));
    this.directory
      .getResolvedApps(this.config().appId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((apps) => this.apps.set(apps));
  }

  private controls(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        `.hai-dock__bar ${CONTROL_SELECTOR}`
      )
    );
  }

  private syncTabStops(): void {
    const controls = this.controls();
    if (!controls.length) return;
    if (!this.tabStop || !controls.includes(this.tabStop)) {
      this.tabStop = controls[0];
    }
    for (const control of controls) {
      const wanted = control === this.tabStop ? '0' : '-1';
      if (control.getAttribute('tabindex') !== wanted) {
        control.setAttribute('tabindex', wanted);
      }
    }
  }
}
