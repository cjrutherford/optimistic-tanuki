import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { stripDays } from './edition-strip.days';

/**
 * The last four weeks of a town's editions, one mark per day.
 *
 * It is how a reader moves between editions, and it also shows coverage at a
 * glance: an empty day is a day with no briefing, which is something a
 * reader of a civic service should be able to see rather than infer.
 */
@Component({
  selector: 'civic-edition-strip',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="strip" aria-label="Editions from the last four weeks">
      <ol>
        @for (entry of days(); track entry.day) {
        <li [class.month-start]="entry.month">
          @if (entry.month) {
          <span class="month" aria-hidden="true">{{ entry.month }}</span>
          } @if (entry.published) {
          <a
            class="mark published"
            [class.current]="entry.current"
            [routerLink]="entry.link"
            [attr.aria-current]="entry.current ? 'page' : null"
            [attr.aria-label]="entry.label"
            [title]="entry.label"
          >
            <span class="initial" aria-hidden="true">{{ entry.initial }}</span>
            <span class="date" aria-hidden="true">{{ entry.date }}</span>
          </a>
          } @else {
          <span class="mark missing" [title]="entry.label + ': no briefing'">
            <span class="initial" aria-hidden="true">{{ entry.initial }}</span>
            <span class="date" aria-hidden="true">{{ entry.date }}</span>
            <span class="visually-hidden">{{ entry.label }}: no briefing</span>
          </span>
          }
        </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './edition-strip.component.scss',
})
export class EditionStripComponent {
  /** Where an edition lives, without its date: `['/city', slug, 'briefing']`. */
  readonly route = input.required<readonly string[]>();
  /** Days with a published edition. */
  readonly published = input.required<readonly string[]>();
  /** The last day shown: the town's newest edition. */
  readonly end = input.required<string>();
  /** The edition being read. */
  readonly current = input<string | null>(null);

  protected readonly days = computed(() =>
    stripDays(this.published(), this.end(), this.current()).map((entry) => ({
      ...entry,
      link: [...this.route(), entry.day],
    }))
  );

  constructor() {
    // On a narrow screen the strip scrolls; open it at the newest days.
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => {
      const strip = host.nativeElement.querySelector('.strip');
      if (strip) strip.scrollLeft = strip.scrollWidth;
    });
  }
}
