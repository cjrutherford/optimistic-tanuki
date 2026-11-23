import { Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { NavBadge } from '../services/attention.service';
import {
  OwnerNavGroup,
  OwnerNavLeaf,
  PICK_A_TOWN,
  resolveLeafPath,
} from '../owner-nav';

/**
 * Grouped, collapsible navigation generated from `OWNER_NAV`. It is docked
 * beside the content on wide screens and becomes a modal drawer on narrow ones;
 * the shell decides which and when to close it.
 */
@Component({
  selector: 'app-owner-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (mode() === 'drawer' && open()) {
    <div class="scrim" (click)="dismissed.emit()" aria-hidden="true"></div>
    }
    <aside
      class="sidebar"
      [class.sidebar--docked]="mode() === 'docked'"
      [class.sidebar--drawer]="mode() === 'drawer'"
      [class.sidebar--open]="open()"
      [attr.aria-hidden]="open() ? null : 'true'"
      [attr.inert]="open() ? null : ''"
      (keydown.escape)="mode() === 'drawer' && dismissed.emit()"
    >
      <nav aria-label="Owner console">
        @for (group of groups(); track group.id) { @if (group.leaves.length ===
        1) {
        <a
          class="link link--solo"
          [routerLink]="group.leaves[0].path"
          [class.link--active]="group.leaves[0].path === activePath()"
          [attr.aria-current]="
            group.leaves[0].path === activePath() ? 'page' : null
          "
          (click)="selected.emit(group.leaves[0].path)"
        >
          <span class="icon" aria-hidden="true">{{ group.icon }}</span>
          {{ group.leaves[0].label }}
          @if (badgeOf(group.leaves[0]); as badge) {
          <span
            class="badge"
            [class.badge--unavailable]="badge.kind === 'unavailable'"
            role="img"
            [attr.aria-label]="badge.label"
            >{{ badgeText(badge) }}</span
          >
          }
        </a>
        } @else {
        <div class="group">
          <button
            type="button"
            class="group-toggle"
            [attr.aria-expanded]="isExpanded(group)"
            [attr.aria-controls]="'nav-group-' + group.id"
            (click)="toggle(group)"
          >
            <span class="icon" aria-hidden="true">{{ group.icon }}</span>
            <span class="group-label">{{ group.label }}</span>
            <span class="chevron" aria-hidden="true">{{
              isExpanded(group) ? '▾' : '▸'
            }}</span>
          </button>
          @if (isExpanded(group)) {
          <ul class="leaves" [id]="'nav-group-' + group.id">
            @for (leaf of group.leaves; track leaf.path) {
            <li>
              <a
                class="link"
                [routerLink]="hrefOf(leaf)"
                [class.link--active]="leaf.path === activePath()"
                [class.link--disabled]="needsPick(leaf)"
                [attr.aria-current]="leaf.path === activePath() ? 'page' : null"
                [attr.aria-disabled]="needsPick(leaf) ? 'true' : null"
                (click)="selected.emit(hrefOf(leaf))"
              >
                <span class="icon" aria-hidden="true">{{ leaf.icon }}</span>
                {{ leaf.label }}
                @if (badgeOf(leaf); as badge) {
                <span
                  class="badge"
                  [class.badge--unavailable]="badge.kind === 'unavailable'"
                  role="img"
                  [attr.aria-label]="badge.label"
                  >{{ badgeText(badge) }}</span
                >
                } @if (needsPick(leaf)) {
                <span class="hint">{{ pickHint }}</span>
                }
              </a>
            </li>
            }
          </ul>
          }
        </div>
        } }
      </nav>
    </aside>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .scrim {
        position: fixed;
        inset: 0;
        z-index: 40;
        background: color-mix(in srgb, var(--foreground) 45%, transparent);
      }

      .sidebar {
        box-sizing: border-box;
        width: 260px;
        overflow-y: auto;
        padding: 12px 8px;
        border-right: 1px solid var(--border-color);
        background: var(--surface);
        color: var(--foreground);
        font-family: var(--font-body, inherit);
        font-size: var(--type-body, 0.95rem);
      }

      .sidebar--docked {
        position: sticky;
        top: 0;
        flex: none;
        align-self: flex-start;
        max-height: 100vh;
      }

      .sidebar--docked:not(.sidebar--open) {
        display: none;
      }

      .sidebar--drawer {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 41;
        max-width: 85vw;
        transform: translateX(-100%);
        visibility: hidden;
        transition: transform 0.2s ease, visibility 0.2s;
        box-shadow: var(--personality-card-shadow, 0 8px 24px rgb(0 0 0 / 0.2));
      }

      .sidebar--drawer.sidebar--open {
        transform: none;
        visibility: visible;
      }

      .group-toggle,
      .link {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 0;
        border-radius: var(--personality-input-radius, 8px);
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
      }

      .group-toggle {
        font-weight: 700;
      }

      .group-label {
        flex: 1;
      }

      .group-toggle:hover,
      .link:hover {
        background: color-mix(in srgb, var(--primary) 10%, transparent);
      }

      .group-toggle:focus-visible,
      .link:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
      }

      .leaves {
        margin: 0 0 4px;
        padding: 0 0 0 14px;
        list-style: none;
      }

      .link--active {
        background: color-mix(in srgb, var(--primary) 18%, transparent);
        font-weight: 700;
      }

      .link--disabled {
        opacity: 0.6;
      }

      .hint {
        margin-left: auto;
        font-size: var(--type-small, 0.8rem);
        font-style: italic;
      }

      .badge {
        flex: none;
        min-width: 1.5em;
        box-sizing: border-box;
        margin-left: auto;
        padding: 0 6px;
        border-radius: 9999px;
        background: var(--primary);
        color: var(--on-primary, var(--primary-foreground, #ffffff));
        font-size: var(--type-small, 0.8rem);
        font-weight: 700;
        line-height: var(--line-height, 1.5);
        text-align: center;
      }

      .badge--unavailable {
        background: transparent;
        border: 2px solid var(--primary);
        color: var(--foreground);
      }

      .icon {
        width: 1.25em;
        text-align: center;
        opacity: 0.8;
      }

      .chevron {
        font-size: var(--type-small, 0.8rem);
      }
    `,
  ],
})
export class OwnerSidebarComponent {
  readonly groups = input.required<readonly OwnerNavGroup[]>();
  readonly activePath = input<string | undefined>();
  /** Selected town; fills `:townId` in town pages. */
  readonly townId = input<string | null>(null);
  readonly pickHint = PICK_A_TOWN;
  readonly open = input(true);
  readonly mode = input<'docked' | 'drawer'>('docked');
  /** Attention badges by `countSource` key; a source with nothing waiting has none. */
  readonly badges = input<Readonly<Record<string, NavBadge>>>({});

  /** A link was followed; the shell closes the drawer. */
  readonly selected = output<string>();
  /** Scrim click or Esc while a drawer. */
  readonly dismissed = output<void>();

  private readonly overrides = signal<Record<string, boolean>>({});

  private readonly activeGroupId = computed(() => {
    const active = this.activePath();
    return this.groups().find((group) =>
      group.leaves.some((leaf) => leaf.path === active)
    )?.id;
  });

  /** Where a leaf goes: its route, or the picker while no town is chosen. */
  hrefOf(leaf: OwnerNavLeaf): string {
    return resolveLeafPath(leaf, this.townId()) ?? '/dashboard/towns';
  }

  badgeOf(leaf: OwnerNavLeaf): NavBadge | null {
    return (leaf.countSource && this.badges()[leaf.countSource]) || null;
  }

  badgeText(badge: NavBadge): string {
    if (badge.kind === 'unavailable') return '!';
    return badge.count > 99
      ? '99+'
      : `${badge.count}${badge.capped ? '+' : ''}`;
  }

  /** A town page with no town selected: shown disabled, links to the picker. */
  needsPick(leaf: OwnerNavLeaf): boolean {
    return !!leaf.needsTown && !this.townId();
  }

  isExpanded(group: OwnerNavGroup): boolean {
    return this.overrides()[group.id] ?? group.id === this.activeGroupId();
  }

  toggle(group: OwnerNavGroup): void {
    const next = !this.isExpanded(group);
    this.overrides.update((current) => ({ ...current, [group.id]: next }));
  }
}
