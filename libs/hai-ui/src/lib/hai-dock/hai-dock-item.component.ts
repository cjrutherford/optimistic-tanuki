import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

/**
 * One button or link in a `hai-dock`. Project it into the dock with its icon
 * as content; the dock supplies layout, roving focus and the hover label, so
 * a bug-report or chat launcher can join the dock without any dock change:
 *
 * ```html
 * <hai-dock [config]="aboutConfig">
 *   <hai-dock-item label="Report a bug" (activated)="openBugReport()">
 *     <svg aria-hidden="true">…</svg>
 *   </hai-dock-item>
 * </hai-dock>
 * ```
 *
 * With `href` it renders a link (`external` opens a new tab); without, a
 * button that emits `activated`. The `label` is the accessible name and the
 * hover/focus label, so the icon content should be decorative.
 */
@Component({
  selector: 'hai-dock-item',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #icon><ng-content></ng-content></ng-template>
    @if (href(); as href) {
    <a
      #control
      class="hai-dock-item__control"
      [attr.href]="href"
      [attr.target]="external() ? '_blank' : null"
      [attr.rel]="external() ? 'noopener noreferrer' : null"
      [attr.aria-label]="accessibleName()"
      [attr.aria-current]="active() ? 'true' : null"
      (click)="activated.emit($event)"
      (keydown)="onKeydown($event)"
    >
      <ng-container [ngTemplateOutlet]="icon"></ng-container>
    </a>
    } @else {
    <button
      #control
      type="button"
      class="hai-dock-item__control"
      [attr.aria-label]="accessibleName()"
      [attr.aria-current]="active() ? 'true' : null"
      [attr.aria-haspopup]="popup()"
      [attr.aria-expanded]="popup() ? expanded() : null"
      (click)="activated.emit($event)"
      (keydown)="onKeydown($event)"
    >
      <ng-container [ngTemplateOutlet]="icon"></ng-container>
    </button>
    }
    <span class="hai-dock-item__label" aria-hidden="true">{{ label() }}</span>
  `,
  styleUrl: './hai-dock-item.component.scss',
  host: {
    class: 'hai-dock-item',
    '[class.is-active]': 'active()',
  },
})
export class HaiDockItemComponent {
  /** Accessible name, and the label shown on hover and focus. */
  readonly label = input.required<string>();
  /** Renders a link instead of a button. */
  readonly href = input<string | null>(null);
  /** The link opens in a new tab; the accessible name says so. */
  readonly external = input(false);
  /** Marks the item as the current one (adds `aria-current` and a marker). */
  readonly active = input(false);
  /** Button only: the popup this button opens (adds `aria-haspopup`). */
  readonly popup = input<'dialog' | null>(null);
  /** Button only, with `popup`: whether that popup is open. */
  readonly expanded = input(false);
  /** Pressing Delete or Backspace on the item asks for it to be removed. */
  readonly removable = input(false);

  /** The button or link was activated. */
  readonly activated = output<Event>();
  /** The visitor asked to remove this item (see `removable`). */
  readonly removeRequested = output<void>();

  private readonly control = viewChild<ElementRef<HTMLElement>>('control');

  protected readonly accessibleName = computed(() =>
    this.href() && this.external()
      ? `${this.label()} (opens in a new tab)`
      : this.label()
  );

  /** Moves focus to the item's button or link. */
  focus(): void {
    this.control()?.nativeElement.focus();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.removable() && ['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault();
      this.removeRequested.emit();
    }
  }
}
