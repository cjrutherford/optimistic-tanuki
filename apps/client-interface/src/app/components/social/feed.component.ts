/**
 * Component for displaying a social feed of posts.
 */
@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatIconModule,
    ComposeComponent,
    PostComponent,
  ],
  providers: [ThemeService, PostService, AttachmentService, CommentService],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit, OnDestroy {
  /**
   * Input property for the list of posts to display.
   */
  @Input() posts: PostDto[] = [];
  /**
   * Styles for the component based on the current theme.
   */
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  /**
   * Subject to signal component destruction for unsubscribing observables.
   */
  destroy$ = new Subject<void>();

  /**
   * Creates an instance of FeedComponent.
   * @param themeService The service for managing themes.
   * @param postService The service for managing posts.
   * @param attachmentService The service for managing attachments.
   * @param commentService The service for managing comments.
   * @param profileService The service for managing user profiles.
   * @param router The Angular router.
   */
  constructor(
    private readonly themeService: ThemeService,
    private readonly postService: PostService,
    private readonly attachmentService: AttachmentService,
    private readonly commentService: CommentService,
    private readonly profileService: ProfileService,
    private readonly router: Router,
  ) {
  }
  
  /**
   * Initializes the component, subscribes to theme changes, and loads posts.
   */
  ngOnInit() {
    this.themeService.themeColors$
    .pipe(
      filter(d => !!d),
      takeUntil(this.destroy$)
    )
    .subscribe((colors) => {
      this.themeStyles = {
        backgroundColor: colors.background,
        color: colors.foreground,
        border: `1px solid ${colors.accent}`,
      };
    });
    const currentProfile = this.profileService.currentUserProfile();
    if(currentProfile){
      this.postService.searchPosts(
        { profileId: currentProfile.id }, {orderBy: 'createdAt', orderDirection: 'desc'}
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe((posts) => {
        this.posts = posts;
        this.loadProfiles(posts);
      });
    } else {
      this.router.navigate(['/profile'])
    }
  }
  /**
   * Object to store profile stubs for posts and comments.
   */
  profiles: { [key: string]: PostProfileStub } = {};


  /**
   * Loads profile stubs for all unique profile IDs found in the given posts.
   * @param posts The array of posts to extract profile IDs from.
   */
  private loadProfiles(posts: PostDto[]) {
    const profileIds: string[] = [
      ...new Set(
        posts
          .flatMap((post) => [
            post.profileId,
            ...(post.comments?.map((comment) => comment.profileId) || []),
          ])
          .filter((x): x is string => !!x)
      ),
    ];
    profileIds.forEach((profileId) => {
      this.profileService.getDisplayProfile(profileId).subscribe((profile) => {
        this.profiles[profileId] = {
          id: profile.id,
          name: profile.profileName,
          avatar: profile.profilePic,
        };
      });
    }
    );
  }

  /**
   * Handles the creation of a new post.
   * @param postData The data for the new post, including attachments and links.
   */
  createdPost(postData: ComposeCompleteEvent) {
    console.log('create called.')
    const { post, attachments, links } = postData;
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }
    const finalPost: CreatePostDto = post as CreatePostDto;
    finalPost.profileId = currentProfile.id;
    this.postService
      .createPost(finalPost)
      .subscribe(async (newPost) => {
        if (attachments.length > 0) {
          for (const atta of attachments) {
            const newAttachment = await firstValueFrom(
              this.attachmentService.createAttachment(atta),
            );
            if (!newPost.attachments) {
              newPost.attachments = [];
            }
            newPost.attachments.push(newAttachment);
          }
        }
        this.posts.unshift(newPost);
      });
  }

  /**
   * Cleans up subscriptions when the component is destroyed.
   */
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }


  /**
   * Handles the creation of a new comment.
   * @param newComment The data for the new comment.
   * @param postIndex The index of the post to which the comment belongs.
   */
  commented(newComment: CreateCommentDto, postIndex: number) {
    console.log('🚀 ~ FeedComponent ~ commented ~ newComment:', newComment);
    newComment.postId = this.posts[postIndex].id;
    newComment.profileId = this.profileService.currentUserProfile()!.id;
    this.commentService.createComment(newComment).subscribe({
      next: (comment) => {
        const post = this.posts.find((p) => p.id === newComment.postId);
        if (post) {
          if (!post.comments) {
            post.comments = [];
          }
          post.comments.push(comment);
        }
      },
      error: (error) => {
        console.error('Error creating comment:', error);
      },
    });
  }

  /**
   * Handles scrolling events (currently a placeholder).
   */
  onScroll() {
    // const length = this.posts.length;
    // this.posts.push(...Array.from({ length: 20 }, (_, i) => `Post #${length + i + 1}`));
  }
}
