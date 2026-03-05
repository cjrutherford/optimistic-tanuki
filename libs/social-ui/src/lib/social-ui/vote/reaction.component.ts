import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

export interface Reaction {
  emoji: string;
  value: number;
  label: string;
}

export const REACTIONS: Reaction[] = [
  { emoji: '❤️', value: 1, label: 'love' },
  { emoji: '😂', value: 2, label: 'laugh' },
  { emoji: '😮', value: 3, label: 'wow' },
  { emoji: '😢', value: 4, label: 'sad' },
  { emoji: '🔥', value: 5, label: 'fire' },
  { emoji: '👏', value: 6, label: 'clap' },
];

@Component({
  selector: 'lib-reaction',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './reaction.component.html',
  styleUrl: './reaction.component.scss',
})
export class ReactionComponent {
  @Input() postId: string = '';
  @Input() userId: string = '';
  @Input() currentReaction: number = 0;
  @Input() reactionCounts: { [value: number]: number } = {};
  @Input() showSummary: boolean = true;
  @Output() reactionSelected = new EventEmitter<{
    postId: string;
    value: number;
  }>();

  reactions = REACTIONS;
  showPicker = false;

  togglePicker() {
    this.showPicker = !this.showPicker;
  }

  closePicker() {
    this.showPicker = false;
  }

  get currentReactionEmoji(): string {
    const reaction = this.reactions.find(
      (r) => r.value === this.currentReaction
    );
    return reaction?.emoji || '😀';
  }

  get totalReactions(): number {
    return Object.values(this.reactionCounts).reduce(
      (sum, count) => sum + count,
      0
    );
  }

  selectReaction(value: number) {
    this.reactionSelected.emit({ postId: this.postId, value });
    this.showPicker = false;
  }

  getCountForReaction(value: number): number {
    return this.reactionCounts[value] || 0;
  }

  get reactionsWithCounts(): { reaction: Reaction; count: number }[] {
    return this.reactions
      .map((r) => ({ reaction: r, count: this.getCountForReaction(r.value) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }
}
