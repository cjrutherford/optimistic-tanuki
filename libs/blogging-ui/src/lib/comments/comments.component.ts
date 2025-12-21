import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CommentListComponent,
  ComposeComponent,
  PostData,
} from '@optimistic-tanuki/social-ui';
import { CommentDto } from '@optimistic-tanuki/ui-models';

@Component({
  selector: 'lib-comments',
  standalone: true,
  imports: [CommonModule, CommentListComponent, ComposeComponent],
  templateUrl: './comments.component.html',
  styleUrl: './comments.component.scss',
})
export class CommentsComponent {
  @Input() comments: CommentDto[] = [];
  @Input() currentUserProfileId: string | null = null;
  @Output() commentSubmit = new EventEmitter<string>();
  @Output() replySubmit = new EventEmitter<{
    content: string;
    parentId: string;
    postId: string;
  }>();

  onCommentSubmit(postData: PostData) {
    this.commentSubmit.emit(postData.content);
  }

  onReply(event: { content: string; parentId: string; postId: string }) {
    this.replySubmit.emit(event);
  }
}
