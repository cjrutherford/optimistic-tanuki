import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export type IconName =
  | 'search'
  | 'home'
  | 'settings'
  | 'person'
  | 'notifications'
  | 'favorite'
  | 'chat'
  | 'share'
  | 'edit'
  | 'delete'
  | 'visibility'
  | 'verified'
  | 'location'
  | 'work'
  | 'email'
  | 'phone'
  | 'calendar'
  | 'image'
  | 'video'
  | 'link'
  | 'tag'
  | 'bookmark'
  | 'flag'
  | 'check'
  | 'close'
  | 'menu'
  | 'more-vertical'
  | 'arrow-back'
  | 'arrow-forward'
  | 'arrow-drop-down'
  | 'add'
  | 'remove'
  | 'filter'
  | 'sort'
  | 'refresh'
  | 'upload'
  | 'download'
  | 'copy'
  | 'cut'
  | 'send'
  | 'heart'
  | 'comment'
  | 'flag-user'
  | 'lock'
  | 'unlock'
  | 'eye'
  | 'eye-off'
  | 'star'
  | 'bell'
  | 'bell-off'
  | 'user-plus'
  | 'user-minus'
  | 'users'
  | 'log-out'
  | 'log-in'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-up'
  | 'chevron-down'
  | 'extension'
  | 'content-copy'
  | 'keyboard-arrow-up'
  | 'keyboard-arrow-down'
  | 'route'
  | 'view-quilt'
  | 'language'
  | 'settings-applications';

@Component({
  selector: 'otui-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.component.html',
  styleUrls: ['./icon.component.scss'],
  host: {
    '[class.theme]': 'theme',
    '[style.--icon-color]': 'foreground',
  },
})
export class IconComponent extends Themeable {
  @Input() name: IconName | string = 'search';

  @Input() size = 24;
  @Input() fill: string | null = null;
  @Input() stroke: string | null = null;
  @Input() strokeWidth = 2;

  override applyTheme(colors: ThemeColors): void {
    if (!this.stroke) {
      this.stroke = colors.foreground;
    }
  }

  get fillValue(): string {
    return this.fill ?? 'none';
  }

  get strokeValue(): string {
    return this.stroke ?? this.foreground;
  }
}
