import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StateMessageTone =
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral';
export type StateMessageKind = 'empty' | 'loading' | 'error' | 'generic';

/**
 * Generic state message: empty / loading / error / generic informational.
 *
 * Use the dedicated wrappers `<otui-empty-state>`, `<otui-loading-state>`, and
 * `<otui-error-state>` for the common cases; they set sensible defaults for
 * `kind` and `tone`.
 */
@Component({
  selector: 'otui-state-message',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './state-message.component.html',
  styleUrls: ['./state-message.component.scss'],
})
export class StateMessageComponent {
  @Input() kind: StateMessageKind = 'generic';
  @Input() tone: StateMessageTone = 'neutral';
  @Input() headline = '';
  @Input() body?: string;
  /** Emoji or single character used as a placeholder icon when no slot is projected. */
  @Input() iconGlyph?: string;
  /** Hide the icon area entirely. */
  @Input() hideIcon = false;
}
