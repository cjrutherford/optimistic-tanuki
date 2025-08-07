import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, GridComponent } from '@optimistic-tanuki/common-ui';
import { CommentDto } from '../../../models';
import { CommentComponent } from '../comment.component';
import { PostProfileStub } from '../../post/post.component';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';

/**
 * Represents a reply to a comment.
 */
export declare type CommentReply = {
  /**
   * The content of the reply.
   */
  content: string;
  /**
   * The ID of the parent comment.
   */
  parentId: string;
  /**
   * The ID of the post the comment belongs to.
   */
  postId: string;
}

/**
 * Component for displaying a list of comments and handling new comments.
 */
@Component({
  selector: 'lib-comment-list',
  standalone: true,
  imports: [CommonModule, CardComponent, GridComponent, CommentComponent, ProfilePhotoComponent],
  providers: [],
  templateUrl: './comment-list.component.html',
  styleUrl: './comment-list.component.scss',
})
export class CommentListComponent {
  /**
   * Input property for the array of comments to display.
   */
  @Input() comments: Array<CommentDto> = [];
  /**
   * Input property for available profiles, keyed by profile ID.
   */
  @Input() availableProfiles: {[key: string]: PostProfileStub} = {};

  /**
   * Emits when a new comment is added.
   */
  @Output() commentAdded: EventEmitter<CommentReply> = new EventEmitter<CommentReply>();

  /**
   * Adds a new comment.
   * @param content The content of the comment.
   * @param parentId The ID of the parent comment (if it's a reply).
   * @param postId The ID of the post the comment belongs to.
   */
  addComment(content: string, parentId: string, postId: string) {
    // this.commentAdded.emit({content, index});
    console.log(content, parentId, postId);
    this.commentAdded.emit({content, parentId, postId});
  }

  /**
   * Retrieves a profile from the available profiles.
   * @param id The ID of the profile to retrieve.
   * @returns The PostProfileStub for the given ID.
   */
  getProfile(id: string) {
    return this.availableProfiles[id];
  }
}
