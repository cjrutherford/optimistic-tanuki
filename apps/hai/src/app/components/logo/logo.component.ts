import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  HAI_LOGO_MARKS,
  HAI_LOGO_VIEW_BOX,
  HAI_LOGO_WORDMARK,
} from './logo-paths';

let nextLogoId = 0;

/**
 * The HAI logo, drawn inline so theme variables reach its fills.
 *
 * Deep parts use `--hai-logo-deep` and bright parts `--hai-logo-bright`;
 * unset, they follow the theme's readable primary text colour and its primary.
 * Decorative by default (it sits inside a labelled link); set `label` when it
 * stands alone.
 */
@Component({
  selector: 'hai-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      [attr.viewBox]="viewBox"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.focusable]="'false'"
    >
      @for (mark of marks; track $index) {
      <g>
        <clipPath [attr.id]="clipId($index)">
          <path [attr.d]="mark.outline" />
        </clipPath>
        <path class="hai-logo-bright" [attr.d]="mark.outline" />
        <path
          class="hai-logo-deep"
          [attr.clip-path]="'url(#' + clipId($index) + ')'"
          [attr.d]="mark.deep"
        />
      </g>
      }
      <path class="hai-logo-deep" [attr.d]="wordmark" />
    </svg>
  `,
  styleUrl: './logo.component.scss',
})
export class HaiLogoComponent {
  /** Accessible name when the logo is not inside a labelled link. */
  readonly label = input<string | null>(null);

  protected readonly viewBox = HAI_LOGO_VIEW_BOX;
  protected readonly marks = HAI_LOGO_MARKS;
  protected readonly wordmark = HAI_LOGO_WORDMARK;
  private readonly uid = nextLogoId++;

  protected clipId(index: number): string {
    return `hai-logo-${this.uid}-clip-${index}`;
  }
}
