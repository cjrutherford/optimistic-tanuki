import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, GridComponent } from '@optimistic-tanuki/common-ui';
import { CommentDto } from '../../../models';
import { CommentComponent } from '../comment.component';
import { PostProfileStub } from '../../post/post.component';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

export declare type CommentReply = {
  content: string;
  parentId: string;
  postId: string;
}

@Component({
  selector: 'lib-comment-list',
  standalone: true,
  imports: [CommonModule, CardComponent, GridComponent, CommentComponent, ProfilePhotoComponent],
  providers: [],
  templateUrl: './comment-list.component.html',
  styleUrl: './comment-list.component.scss',
})
export class CommentListComponent {
  @Input() comments: Array<CommentDto> = [];
  @Input() availableProfiles: {[key: string]: PostProfileStub} = {};

  @Output() commentAdded: EventEmitter<CommentReply> = new EventEmitter<CommentReply>();

  addComment(content: string, parentId: string, postId: string) {
    // this.commentAdded.emit({content, index});
    console.log(content, parentId, postId);
    this.commentAdded.emit({content, parentId, postId});
  }

  getProfile(id: string) {
    return this.availableProfiles[id];
  }
}
