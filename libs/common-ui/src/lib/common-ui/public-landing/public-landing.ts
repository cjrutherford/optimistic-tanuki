import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {
  StateMessageComponent,
  type StateMessageKind,
  type StateMessageTone,
} from '../states/state-message.component';

/** A link shown in a public landing header. */
export interface DiscoveryNavItem {
  label: string;
  href: string;
  current?: boolean;
  external?: boolean;
}

/** A prominent landing-page call to action. */
export interface DiscoveryAction {
  label: string;
  href: string;
  external?: boolean;
}

/** App-agnostic content for a public discovery card. */
export interface DiscoveryCard {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  imageUrl?: string;
  imageAlt?: string;
  meta?: string;
  actionLabel?: string;
  actionHref?: string;
  external?: boolean;
  featured?: boolean;
}

export type DiscoveryListState = 'ready' | 'loading' | 'empty' | 'error';
export type LandingStatusState = Exclude<DiscoveryListState, 'ready'>;

@Component({
  selector: 'otui-public-landing-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="public-landing-header">
      <div class="public-landing-header__inner">
        <div class="public-landing-header__brand">
          <ng-content select="[slot=brand]"></ng-content>
          @if (brandLabel) {
          <a
            class="public-landing-header__brand-link"
            [href]="brandHref"
            [attr.target]="brandExternal ? '_blank' : null"
            [attr.rel]="brandExternal ? 'noopener noreferrer' : null"
          >
            {{ brandLabel }}
          </a>
          }
        </div>

        <button
          #menuButton
          class="public-landing-header__menu"
          type="button"
          [attr.aria-expanded]="menuOpen"
          [attr.aria-controls]="resolvedNavigationId"
          [attr.aria-label]="menuOpen ? 'Close navigation' : 'Open navigation'"
          (click)="toggleMenu()"
        >
          <span aria-hidden="true">{{ menuOpen ? 'Close' : 'Menu' }}</span>
        </button>

        <nav
          class="public-landing-header__nav"
          [id]="resolvedNavigationId"
          aria-label="Primary navigation"
          [attr.data-open]="menuOpen"
        >
          @for (item of navItems; track item) {
          <a
            class="public-landing-header__nav-link"
            [href]="item.href"
            [attr.aria-current]="item.current ? 'page' : null"
            [attr.target]="item.external ? '_blank' : null"
            [attr.rel]="item.external ? 'noopener noreferrer' : null"
            (click)="closeMenu()"
          >
            {{ item.label }}
          </a>
          }
        </nav>

        <div class="public-landing-header__actions">
          <ng-content select="[slot=actions]"></ng-content>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class LandingHeaderComponent {
  private static nextNavigationId = 0;

  @Input() brandLabel?: string;
  @Input() brandHref = '/';
  @Input() brandExternal = false;
  @Input() navItems: DiscoveryNavItem[] = [];
  @Input() navigationId?: string;
  @Output() menuToggled = new EventEmitter<boolean>();

  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;

  readonly defaultNavigationId = `otui-public-landing-navigation-${LandingHeaderComponent.nextNavigationId++}`;
  menuOpen = false;

  get resolvedNavigationId(): string {
    return this.navigationId || this.defaultNavigationId;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
    this.menuToggled.emit(this.menuOpen);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    if (!this.menuOpen) {
      return;
    }

    this.menuOpen = false;
    this.menuToggled.emit(false);
    this.menuButton?.nativeElement.focus();
  }
}

@Component({
  selector: 'otui-public-landing-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="public-landing-hero"
      [attr.aria-labelledby]="resolvedHeadingId"
    >
      <div class="public-landing-hero__inner">
        <div class="public-landing-hero__copy">
          @if (eyebrow) {
          <p class="public-landing-hero__eyebrow">{{ eyebrow }}</p>
          }
          <h1 [id]="resolvedHeadingId">{{ heading }}</h1>
          @if (description) {
          <p class="public-landing-hero__description">{{ description }}</p>
          }
          <div class="public-landing-hero__body">
            <ng-content select="[slot=body]"></ng-content>
          </div>
          <div class="public-landing-hero__actions">
            @if (primaryAction) {
            <a
              class="public-landing-action public-landing-action--primary"
              [href]="primaryAction.href"
              [attr.target]="primaryAction.external ? '_blank' : null"
              [attr.rel]="primaryAction.external ? 'noopener noreferrer' : null"
            >
              {{ primaryAction.label }}
            </a>
            } @if (secondaryAction) {
            <a
              class="public-landing-action public-landing-action--secondary"
              [href]="secondaryAction.href"
              [attr.target]="secondaryAction.external ? '_blank' : null"
              [attr.rel]="
                secondaryAction.external ? 'noopener noreferrer' : null
              "
            >
              {{ secondaryAction.label }}
            </a>
            }
            <ng-content select="[slot=actions]"></ng-content>
          </div>
        </div>

        <div class="public-landing-hero__visual">
          <ng-content select="[slot=visual]"></ng-content>
          @if (imageUrl) {
          <img [src]="imageUrl" [alt]="imageAlt" />
          }
        </div>
      </div>
    </section>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class LandingHeroComponent {
  private static nextHeadingId = 0;

  @Input() eyebrow?: string;
  @Input() heading = '';
  @Input() description?: string;
  @Input() primaryAction?: DiscoveryAction;
  @Input() secondaryAction?: DiscoveryAction;
  @Input() imageUrl?: string;
  @Input() imageAlt = '';
  @Input() headingId?: string;

  readonly defaultHeadingId = `otui-public-landing-hero-heading-${LandingHeroComponent.nextHeadingId++}`;
  get resolvedHeadingId(): string {
    return this.headingId || this.defaultHeadingId;
  }
}

@Component({
  selector: 'otui-public-discovery-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="public-discovery-card"
      [class.public-discovery-card--featured]="item.featured"
    >
      <div class="public-discovery-card__media">
        <ng-content select="[slot=media]"></ng-content>
        @if (item.imageUrl) {
        <img
          [src]="item.imageUrl"
          [alt]="item.imageAlt === undefined ? item.title : item.imageAlt"
        />
        }
      </div>
      <div class="public-discovery-card__body">
        @if (item.eyebrow) {
        <p class="public-discovery-card__eyebrow">{{ item.eyebrow }}</p>
        }
        <h3>
          @if (item.href) {
          <a
            [href]="item.href"
            [attr.target]="item.external ? '_blank' : null"
            [attr.rel]="item.external ? 'noopener noreferrer' : null"
          >
            {{ item.title }}
          </a>
          } @else {
          {{ item.title }}
          }
        </h3>
        @if (item.description) {
        <p class="public-discovery-card__description">
          {{ item.description }}
        </p>
        }
        <div class="public-discovery-card__meta">
          @if (item.meta) {
          <span>{{ item.meta }}</span>
          }
          <ng-content select="[slot=meta]"></ng-content>
        </div>
        <div class="public-discovery-card__actions">
          @if (item.actionLabel && (item.actionHref || item.href)) {
          <a
            class="public-landing-action public-landing-action--secondary"
            [href]="item.actionHref || item.href"
            [attr.target]="item.external ? '_blank' : null"
            [attr.rel]="item.external ? 'noopener noreferrer' : null"
          >
            {{ item.actionLabel }}
          </a>
          }
          <ng-content select="[slot=actions]"></ng-content>
        </div>
      </div>
    </article>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class DiscoveryCardComponent {
  @Input() item: DiscoveryCard = { title: '' };
}

@Component({
  selector: 'otui-landing-status',
  standalone: true,
  imports: [CommonModule, StateMessageComponent],
  template: `
    <otui-state-message
      [kind]="messageKind"
      [tone]="messageTone"
      [headline]="resolvedHeadline"
      [body]="body"
      [iconGlyph]="resolvedIconGlyph"
    >
      <ng-content select="[slot=icon]"></ng-content>
      <ng-content select="[slot=actions]"></ng-content>
    </otui-state-message>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class LandingStatusComponent {
  @Input() state: LandingStatusState = 'empty';
  @Input() headline?: string;
  @Input() body?: string;
  @Input() iconGlyph?: string;

  get resolvedHeadline(): string {
    return (
      this.headline ??
      (this.state === 'loading'
        ? 'Loading discoveries'
        : this.state === 'error'
        ? 'Discoveries are unavailable'
        : 'Nothing to discover yet')
    );
  }

  get resolvedIconGlyph(): string {
    return (
      this.iconGlyph ??
      (this.state === 'loading'
        ? '\u25CF'
        : this.state === 'error'
        ? '\u26A0'
        : '\u2728')
    );
  }

  get messageKind(): StateMessageKind {
    return this.state;
  }

  get messageTone(): StateMessageTone {
    return this.state === 'error'
      ? 'danger'
      : this.state === 'loading'
      ? 'info'
      : 'neutral';
  }
}

@Component({
  selector: 'otui-public-discovery-list',
  standalone: true,
  imports: [CommonModule, DiscoveryCardComponent, LandingStatusComponent],
  template: `
    <div
      class="public-discovery-list"
      [attr.data-layout]="layout"
      [attr.aria-busy]="state === 'loading'"
    >
      <ng-content select="[slot=before-list]"></ng-content>
      @if (state === 'ready') { @if (items.length) {
      <ul [attr.aria-label]="ariaLabel">
        @for (item of items; track item.id ?? $index) {
        <li>
          <otui-public-discovery-card [item]="item" />
        </li>
        }
      </ul>
      } @else {
      <otui-landing-status
        state="empty"
        [headline]="emptyHeadline"
        [body]="emptyBody"
      />
      } } @else {
      <otui-landing-status
        [state]="state"
        [headline]="
          state === 'loading'
            ? loadingHeadline
            : state === 'empty'
            ? emptyHeadline
            : errorHeadline
        "
        [body]="
          state === 'loading'
            ? loadingBody
            : state === 'empty'
            ? emptyBody
            : errorBody
        "
      />
      }
      <ng-content select="[slot=after-list]"></ng-content>
    </div>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class DiscoveryListComponent {
  @Input() items: DiscoveryCard[] = [];
  @Input() state: DiscoveryListState = 'ready';
  @Input() layout: 'grid' | 'list' = 'grid';
  @Input() ariaLabel = 'Discoveries';
  @Input() emptyHeadline = 'Nothing to discover yet';
  @Input() emptyBody?: string;
  @Input() loadingHeadline = 'Loading discoveries';
  @Input() loadingBody?: string;
  @Input() errorHeadline = 'Discoveries are unavailable';
  @Input() errorBody?: string;
}

@Component({
  selector: 'otui-public-discovery-region',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section
      class="public-discovery-region"
      [attr.aria-labelledby]="resolvedHeadingId"
    >
      <div class="public-discovery-region__header">
        <div>
          @if (eyebrow) {
          <p class="public-discovery-region__eyebrow">{{ eyebrow }}</p>
          }
          <h2 [id]="resolvedHeadingId">{{ heading }}</h2>
          @if (description) {
          <p class="public-discovery-region__description">{{ description }}</p>
          }
        </div>
        <div class="public-discovery-region__actions">
          <ng-content select="[slot=actions]"></ng-content>
        </div>
      </div>
      <div class="public-discovery-region__content">
        <ng-content></ng-content>
      </div>
    </section>
  `,
  styleUrls: ['./public-landing.component.scss'],
})
export class DiscoveryRegionComponent {
  private static nextHeadingId = 0;

  @Input() eyebrow?: string;
  @Input() heading = '';
  @Input() description?: string;
  @Input() headingId?: string;

  readonly defaultHeadingId = `otui-public-discovery-region-heading-${DiscoveryRegionComponent.nextHeadingId++}`;
  get resolvedHeadingId(): string {
    return this.headingId || this.defaultHeadingId;
  }
}
