import {
  Component,
  EventEmitter,
  HostListener,
  inject,
  Output,
} from '@angular/core';

import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { FormsModule } from '@angular/forms';
import TurndownService from 'turndown';

@Component({
  selector: 'lib-compose-chat',
  imports: [FormsModule],
  providers: [],
  templateUrl: './compose-chat.component.html',
  styleUrl: './compose-chat.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  },
})
export class ComposeChatComponent extends Themeable {
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();
  content = '';

  localAccent = 'var(--accent, #3f51b5)';
  localbackground = 'var(--background, #ffffff)';

  override applyTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.background}, ${colors.accent})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.localAccent = colors.accent;
    this.localbackground = colors.background;
    this.complement = colors.complementary;
    if (this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][0];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
  }

  submitMessage() {
    if (!this.content.trim()) return;

    const turndownService = new TurndownService();
    let markdown = turndownService.turndown(this.content);
    markdown = markdown.replace(
      /(https?:\/\/[^\s]+)/g,
      (url) => `[${url}](${url})`
    );
    this.messageSubmitted.emit(markdown);
    this.content = '';
  }

  onContentChanged(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.content = target.value;
  }

  @HostListener('keydown.ctrl.enter')
  @HostListener('keydown.meta.enter')
  onCtrlEnter(): void {
    this.submitMessage();
  }
}
