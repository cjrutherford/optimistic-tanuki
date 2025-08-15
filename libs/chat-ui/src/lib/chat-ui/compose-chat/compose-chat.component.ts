import { Component, EventEmitter, inject, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QuillModule } from 'ngx-quill';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-ui';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';
import { FormsModule } from '@angular/forms';
import TurndownService from 'turndown';

@Component({
  selector: 'lib-compose-chat',
  imports: [CommonModule, FormsModule, QuillModule, ButtonComponent],
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
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementaryShades[0][1];
    this.borderColor = colors.accentGradients[0][1];
    this.borderGradient = colors.complementaryGradients[0][1];
    this.transitionDuration ='0.3s';
    if(this.theme === 'dark') {
      this.background = colors.background;
      this.foreground = colors.foreground;
      this.accent = colors.accent;
      this.complement = colors.complementaryShades[0][1];
      this.borderColor = colors.accentGradients[0][1];
      this.borderGradient = colors.complementaryGradients[0][1];
    } else {
      this.background = colors.background;
      this.foreground = colors.foreground;
      this.accent = colors.accent;
      this.complement = colors.complementaryShades[0][1];
      this.borderColor = colors.accentGradients[0][1];
      this.borderGradient = colors.complementaryGradients[0][1];
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
