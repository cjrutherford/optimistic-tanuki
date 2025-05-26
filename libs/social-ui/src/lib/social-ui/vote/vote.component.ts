import { Component } from '@angular/core';
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
  voteState: 1 | 0 | -1 = 0;;

  upvote() {
    this.voteState = 1;
  }

  downvote() {
    this.voteState = -1;
  }

  cancelVote() {
    this.voteState = 0;
  }
}
