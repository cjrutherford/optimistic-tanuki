import { Component, EventEmitter, Output } from '@angular/core';

import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { FormsModule } from '@angular/forms';
import TurndownService from 'turndown';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-compose-chat',
  imports: [FormsModule, ButtonComponent],
  providers: [],
  templateUrl: './compose-chat.component.html',
  styleUrl: './compose-chat.component.scss',
  host: {
    '[style.--background]': 'background',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--transition-duration]': 'transitionDuration',
  },
})
export class ComposeChatComponent extends Themeable {
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();
  @Output() submissionRequested = new EventEmitter<{
    content: string;
    settle: (accepted: boolean) => void;
  }>();
  content = '';
  pendingSubmission = false;
  submissionError: string | null = null;

  override applyTheme(colors: ThemeColors): void {
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = `color-mix(in srgb, ${colors.accent} 20%, ${colors.background})`;
    this.transitionDuration = '150ms';
  }

  submitMessage() {
    if (!this.content.trim() || this.pendingSubmission) return;
    const contentAtSubmit = this.content;

    const turndownService = new TurndownService();
    const htmlContent = this.content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean)
      .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');

    let markdown = turndownService.turndown(htmlContent);
    markdown = markdown.replace(
      /(https?:\/\/[^\s]+)/g,
      (url) => `[${url}](${url})`
    );
    this.pendingSubmission = true;
    this.submissionError = null;
    let settled = false;
    this.submissionRequested.emit({
      content: markdown,
      settle: (accepted) => {
        if (settled) return;
        settled = true;
        this.pendingSubmission = false;
        if (accepted) {
          if (this.content === contentAtSubmit) this.content = '';
        } else {
          this.submissionError =
            'Message could not be sent. Your draft is still here; try again.';
        }
      },
    });
    // Keep the existing string event for callers that have not opted in to
    // acknowledged delivery. The chat window selects exactly one event path.
    this.messageSubmitted.emit(markdown);
  }

  onContentChanged(event: Event) {
    const target = event.target as HTMLTextAreaElement;
    this.content = target.value;
    this.submissionError = null;
  }

  onEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    if (event.shiftKey) {
      this.content = `${this.content}\n\n`;
      return;
    }

    this.submitMessage();
  }
}
