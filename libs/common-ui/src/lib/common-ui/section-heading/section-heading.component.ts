import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Themed page/section header.
 *
 * Defaults derive from semantic theme tokens. The legacy `background`,
 * `padding`, `borderRadius`, and `color` inputs remain for backward
 * compatibility but should not be set in new code; instead let the consuming
 * personality drive appearance via CSS custom properties.
 */
@Component({
  selector: 'otui-section-heading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-heading.component.html',
  styleUrls: ['./section-heading.component.scss'],
})
export class SectionHeadingComponent {
  /** Optional small text above the heading (kicker / eyebrow). */
  @Input() eyebrow?: string;
  @Input() heading = '';
  @Input() subheading?: string;

  /** @deprecated Override via CSS custom properties on the host instead. */
  @Input() background?: string;
  /** @deprecated Override via CSS custom properties on the host instead. */
  @Input() padding?: string;
  /** @deprecated Override via CSS custom properties on the host instead. */
  @Input() borderRadius?: string;
  /** @deprecated Override via CSS custom properties on the host instead. */
  @Input() color?: string;
}
