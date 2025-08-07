/**
 * Represents a stub for a post's profile information.
 */
export declare type PostProfileStub = {
  /**
   * The unique identifier of the profile.
   */
  id: string;
  /**
   * The name of the profile.
   */
  name: string;
  /**
   * The URL of the profile's avatar.
   */
  avatar: string;
};

/**
 * Component for displaying a social media post with its content, attachments, links, comments, and voting options.
 */
@Component({
  selector: 'lib-post',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    VoteComponent,
    CommentComponent,
    GridComponent,
    TileComponent,
    CommentListComponent,
    ProfilePhotoComponent,
  ],
  providers: [],
  templateUrl: './post.component.html',
  styleUrl: './post.component.scss',
})
export class PostComponent {
  /**
   * Input property for the profile associated with the post.
   */
  @Input() profile: PostProfileStub | null = {
    id: '',
    name: 'unknown',
    avatar: 'https://placehold.co/300x300',
  };
  /**
   * Input property for available profiles, keyed by profile ID.
   */
  @Input() availableProfiles: {[key: string]: PostProfileStub} = {};
  /**
   * The current theme (light or dark).
   */
  theme: 'light' | 'dark' = 'light';
  

  /**
   * Input property for the post content.
   */
  @Input() content!: PostDto;
  /**
   * Input property for the comments associated with the post.
   */
  @Input() comments: CommentDto[] = [];
  /**
   * Input property for the attachments associated with the post.
   */
  @Input() attachments: AttachmentDto[] = [];
  /**
   * Input property for the links associated with the post.
   */
  @Input() links: LinkType[] = [];
  /**
   * Emits when a new comment is added to the post.
   */
  @Output() newCommentAdded: EventEmitter<CreateCommentDto> =
  new EventEmitter<CreateCommentDto>();
  
  /**
   * Handles the download of an attachment.
   * @param attachment The attachment to download.
   */
  downloadAttachment(attachment: AttachmentDto) {
    // Logic to download the attachment
    console.log('Downloading attachment:', attachment);
  }
  /**
   * Handles opening a link.
   * @param link The link to open.
   */
  openLink(link: { url: string }) {
    // Logic to open the link
    console.log('Opening link:', link);
  }



  /**
   * Calculates the number of rows needed to display attachments.
   * @returns The number of attachment rows.
   */
  get attachmentRows() {
    return Math.ceil(this.attachments.length / 6);
  }

  /**
   * Handles a reply to a comment.
   * @param $event The event object containing content, parentId, and postId.
   */
  onCommentReply($event: { content: string; parentId: string }) {
    console.log('🚀 ~ PostComponent ~ onCommentReply ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event.content,
      postId: this.content.id,
      profileId: '',
      parentId: $event.parentId,
    };
    this.newCommentAdded.emit(comment);
  }
  /**
   * Handles adding a new comment to the post.
   * @param $event The content of the new comment.
   */
  onCommentAdd($event: string) {
    console.log('🚀 ~ PostComponent ~ onCommentAdd ~ $event:', $event);
    const comment: CreateCommentDto = {
      content: $event,
      postId: this.content.id,
      profileId: '',
    };
    this.newCommentAdded.emit(comment);
  }
}
