import { Component, EventEmitter, inject, Output } from '@angular/core';

import { QuillModule } from 'ngx-quill';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { FormsModule } from '@angular/forms';
import TurndownService from 'turndown';

@Component({
  selector: 'lib-compose-chat',
  imports: [FormsModule, QuillModule, ButtonComponent],
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
  }
})
export class ComposeChatComponent extends Themeable{
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();
  content = '';
  

  override applyTheme(colors: ThemeColors): void {
    this.background = `radial-gradient(ellipse, ${colors.background}, ${colors.accent})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
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
    const turndownService = new TurndownService();
    let markdown = turndownService.turndown(this.content);
    markdown = markdown.replace(
      /(https?:\/\/[^\s]+)/g,
      (url) => `[${url}](${url})`
    );
    this.messageSubmitted.emit(markdown);
    this.content = '';
  }

  onContentChanged(event: any) {
    this.content = event.html;
  }
}
