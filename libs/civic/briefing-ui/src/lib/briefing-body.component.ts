import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { renderBriefing } from './render';

/**
 * A briefing's text. `[innerHTML]` is bound to a plain string, never one
 * marked as trusted, so Angular sanitizes it wherever it renders; see
 * render.ts.
 */
@Component({
  selector: 'civic-briefing-body',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="briefing-text" [innerHTML]="html()"></div>`,
  styleUrl: './briefing-body.component.scss',
})
export class BriefingBodyComponent {
  readonly markdown = input.required<string>();
  protected readonly html = computed(() => renderBriefing(this.markdown()));
}
