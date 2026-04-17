import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-vote',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './vote.component.html',
  styleUrl: './vote.component.scss',
})
export class VoteComponent {
  @Input() postId: string = '';
  @Input() userId: string = '';
  @Input() currentVote: number = 0;
  @Input() voteCount: number = 0;
  @Output() voteChanged = new EventEmitter<{ postId: string; value: number }>();

  get isUpvoted(): boolean {
    return this.currentVote === 1;
  }

  get isDownvoted(): boolean {
    return this.currentVote === -1;
  }

  upvote() {
    const newValue = this.isUpvoted ? 0 : 1;
    this.voteChanged.emit({ postId: this.postId, value: newValue });
  }

  downvote() {
    const newValue = this.isDownvoted ? 0 : -1;
    this.voteChanged.emit({ postId: this.postId, value: newValue });
  }
}
