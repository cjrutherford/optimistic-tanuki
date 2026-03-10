import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  signal,
  inject,
} from '@angular/core';

import {
  ButtonComponent,
  SpinnerComponent,
} from '@optimistic-tanuki/common-ui';
import {
  PostDto,
  ComposeComponent,
  PostComponent,
  CreatePostDto,
  CreateCommentDto,
  PostData,
  ImageUploadCallback,
} from '@optimistic-tanuki/social-ui';
import {
  CreateAttachmentDto,
  CreateSocialComponentDto,
  CommunityDto,
} from '@optimistic-tanuki/ui-models';
import { InjectedComponentData } from '@optimistic-tanuki/compose-lib';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PostService } from '../../post.service';
import { AttachmentService } from '../../attachment.service';
import { filter, firstValueFrom, Subject, takeUntil } from 'rxjs';
import { CommentService } from '../../comment.service';
import { ProfileService } from '../../profile.service';
import { Router } from '@angular/router';
import { PostProfileStub } from '@optimistic-tanuki/social-ui';
import { SocialWebSocketService } from '../../social-websocket.service';
import { AssetService } from '../../asset.service';
import { CreateAssetDto, FollowDto } from '@optimistic-tanuki/ui-models';
import { FollowService } from '../../follow.service';
import { HttpClient } from '@angular/common/http';
import { CommunityService } from '../../community.service';
import { VoteService } from '../../vote.service';
import { ReactionService } from '../../reaction.service';
import { InfiniteScrollDirective } from '../../directives/infinite-scroll.directive';
import { LazyLoadDirective } from '../../directives/lazy-load.directive';
import { ActivityService } from '../../activity.service';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    ButtonComponent,
    SpinnerComponent,
    ComposeComponent,
    PostComponent,
    InfiniteScrollDirective,
    LazyLoadDirective,
  ],
  providers: [
    ThemeService,
    PostService,
    AttachmentService,
    CommentService,
    SocialWebSocketService,
    AssetService,
    FollowService,
    VoteService,
    ReactionService,
    ActivityService,
  ],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit, OnDestroy {
  posts = signal<PostDto[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  hasMorePosts = signal(true);
  private currentPage = 0;
  private pageSize = 20;
  private currentVisibility: 'public' | 'following' | 'communities' = 'public';
  private currentCommunityIds: string[] = [];
  followingIds = new Set<string>();
  blockedIds = new Set<string>();
  ownedCommunities = signal<{ id: string; name: string }[]>([]);
  communityInfo = signal<{
    [key: string]: { id: string; name: string; logoUrl?: string };
  }>({});
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  destroy$ = new Subject<void>();

  // Track user votes for each post: postId -> vote value (0 = no vote)
  userVotes = signal<{ [postId: string]: number }>({});
  // Track vote counts: postId -> count
  voteCounts = signal<{ [postId: string]: number }>({});
  // Track user reactions: postId -> reaction value (0 = no reaction)
  userReactions = signal<{ [postId: string]: number }>({});
  // Track reaction counts: postId -> { value -> count }
  reactionCounts = signal<{ [postId: string]: { [value: number]: number } }>(
    {}
  );
  // Track saved items: postId -> boolean
  savedPosts = signal<{ [postId: string]: boolean }>({});

  // Image upload callback for the compose component
  imageUploadCallback: ImageUploadCallback = async (
    dataUrl: string,
    fileName: string
  ): Promise<string> => {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      throw new Error('No current profile found');
    }

    // Extract file extension from data URL
    const fileExtension = this.getFileExtensionFromDataUrl(dataUrl);

    const assetDto: CreateAssetDto = {
      name: fileName,
      profileId: currentProfile.id,
      type: 'image',
      content: dataUrl,
      fileExtension: fileExtension,
    };

    try {
      const asset = await firstValueFrom(
        this.assetService.createAsset(assetDto)
      );
      return this.assetService.getAssetUrl(asset.id);
    } catch (error) {
      console.error('Failed to upload image to asset service:', error);
      throw error;
    }
  };

  themeService = inject(ThemeService);
  postService = inject(PostService);
  attachmentService = inject(AttachmentService);
  commentService = inject(CommentService);
  profileService = inject(ProfileService);
  router = inject(Router);
  socialWebSocketService = inject(SocialWebSocketService);
  assetService = inject(AssetService);
  followService = inject(FollowService);
  communityService = inject(CommunityService);
  voteService = inject(VoteService);
  reactionService = inject(ReactionService);
  activityService = inject(ActivityService);
  private readonly http = inject(HttpClient);
  private readonly gatewayUrl = 'http://localhost:3000/social';

  ngOnInit() {
    this.themeService.themeColors$
      .pipe(
        filter((d) => !!d),
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
    if (currentProfile) {
      // Load initial following list for the current profile
      this.loadFollowing(currentProfile.id);
      this.loadOwnedCommunities();
      this.loadBlockedUsers(currentProfile.id);

      // Connect to WebSocket
      this.socialWebSocketService.connect();

      // Subscribe to WebSocket connection status
      this.socialWebSocketService
        .getConnectionStatus()
        .pipe(takeUntil(this.destroy$))
        .subscribe((connected) => {
          if (connected) {
            console.log('WebSocket connected, loading feed...');
            // Get initial feed via WebSocket
            this.socialWebSocketService.getFeed(currentProfile.id, 50, 0);
            // Subscribe to all posts updates
            this.socialWebSocketService.subscribeToPosts(currentProfile.id);
          }
        });

      // Subscribe to posts from WebSocket
      this.socialWebSocketService
        .getPosts()
        .pipe(takeUntil(this.destroy$))
        .subscribe((posts) => {
          console.log('Received posts from WebSocket:', posts.length);
          this.posts.set(posts);
          this.loading.set(false);
          this.loadProfiles(posts);
          this.loadReactionData(posts);
          this.loadCommunityInfo(posts);
        });

      // Fallback to HTTP if WebSocket doesn't connect within 5 seconds
      setTimeout(() => {
        if (
          !this.socialWebSocketService.isConnected() &&
          this.posts().length === 0
        ) {
          console.log('WebSocket not connected, falling back to HTTP');
          this.postService
            .searchPosts({}, { orderBy: 'createdAt', orderDirection: 'desc' })
            .pipe(takeUntil(this.destroy$))
            .subscribe((posts) => {
              this.posts.set(posts);
              this.loading.set(false);
              this.loadProfiles(posts);
              this.loadCommunityInfo(posts);
              this.loadReactionData(posts);
            });
        }
      }, 5000);
    } else {
      this.router.navigate(['/profile']);
    }
  }
  profiles = signal<{ [key: string]: PostProfileStub }>({});

  currentFeed: 'public' | 'following' | 'communities' = 'public';

  private loadFollowing(profileId: string) {
    this.followService.getFollowing(profileId).subscribe({
      next: (following) => {
        // API returns FollowEntity objects `{ id, followerId, followeeId, ... }`.
        // We care about the profiles the current user is following, which are
        // identified by `followeeId`.
        this.followingIds.clear();
        if (Array.isArray(following)) {
          following.forEach((f) => {
            const followeeId = (f as any).followeeId ?? (f as any).id;
            if (followeeId) {
              this.followingIds.add(followeeId);
            }
          });
        }
        console.log('Following IDs loaded:', Array.from(this.followingIds));
      },
      error: (err) => console.error('Failed to load following', err),
    });
  }

  private loadOwnedCommunities() {
    this.communityService.getUserCommunities().subscribe({
      next: (communities) => {
        const owned = communities
          .filter((c: CommunityDto) => {
            const currentProfile = this.profileService.currentUserProfile();
            return currentProfile && c.ownerId === currentProfile.userId;
          })
          .map((c: CommunityDto) => ({ id: c.id, name: c.name }));
        this.ownedCommunities.set(owned);
      },
      error: (err) => console.error('Failed to load owned communities', err),
    });
  }

  private loadBlockedUsers(profileId: string) {
    this.profileService.getBlockedUsers(profileId).subscribe({
      next: (blocked) => {
        this.blockedIds.clear();
        if (Array.isArray(blocked)) {
          blocked.forEach((b: any) => {
            if (b.blockedProfileId) {
              this.blockedIds.add(b.blockedProfileId);
            }
          });
        }
        console.log('Blocked IDs loaded:', Array.from(this.blockedIds));
      },
      error: (err) => console.error('Failed to load blocked users', err),
    });
  }

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
        this.profiles.update((p: { [key: string]: PostProfileStub }) => ({
          ...p,
          [profileId]: {
            id: profile.id,
            name: profile.profileName,
            avatar: profile.profilePic,
          },
        }));
      });
    });
  }

  private loadCommunityInfo(posts: PostDto[]) {
    const communityIds = [
      ...new Set(
        posts.map((post) => post.communityId).filter((id): id is string => !!id)
      ),
    ];
    if (communityIds.length === 0) return;

    communityIds.forEach((communityId) => {
      this.communityService.getCommunity(communityId).subscribe({
        next: (community: CommunityDto) => {
          if (community) {
            this.communityInfo.update((info) => ({
              ...info,
              [communityId]: {
                id: community.id,
                name: community.name,
                logoUrl: community.logoAssetId
                  ? `/api/asset/${community.logoAssetId}`
                  : community.logoUrl,
              },
            }));
          }
        },
        error: (err: any) =>
          console.error('Failed to load community info:', err),
      });
    });
  }

  async createdPost(postData: PostData) {
    console.log('[Feed] create called with postData:', postData);
    const { title, content, attachments, links, injectedComponentsNew } =
      postData;
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }

    const finalPost: CreatePostDto = {
      title,
      content,
      profileId: currentProfile.id,
    };

    let newPost: PostDto | null = null;

    try {
      // 1. Create post
      newPost = await firstValueFrom(this.postService.createPost(finalPost));
      console.log('[Feed] Post created:', newPost.id);

      // 2. Create attachments
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          const atta: CreateAttachmentDto = {
            ...attachment,
            postId: newPost.id,
          };
          await firstValueFrom(this.attachmentService.createAttachment(atta));
        }
        console.log(`[Feed] ${attachments.length} attachments created`);
      }

      // 3. Create components (NEW)
      if (
        injectedComponentsNew &&
        injectedComponentsNew.length > 0 &&
        newPost
      ) {
        console.log(`[Feed] Saving ${injectedComponentsNew.length} components`);
        try {
          await this.saveComponents(newPost.id, injectedComponentsNew);
        } catch (componentError) {
          // ROLLBACK: Component save failed, delete the post
          console.error(
            '[Feed] Component save failed, rolling back post:',
            componentError
          );
          await this.rollbackPost(newPost.id);
          throw new Error(
            'Failed to save post components. Post has been removed.'
          );
        }
      }

      // 4. Update UI
      // Ensure profile is in map for the new post
      if (!this.profiles()[currentProfile.id]) {
        this.profiles.update((p: { [key: string]: PostProfileStub }) => ({
          ...p,
          [currentProfile.id]: {
            id: currentProfile.id,
            name: currentProfile.profileName || 'Me',
            avatar: currentProfile.profilePic,
          },
        }));
      }
      if (newPost) {
        const newPostId = newPost.id;
        if (!this.posts().some((p) => p.id === newPostId)) {
          this.posts.update((posts) => [newPost!, ...posts]);
        }
      }
      console.log('[Feed] Post added to feed');
    } catch (error) {
      console.error('[Feed] Failed to create post:', error);
      // Re-throw to let the compose component handle the error display
      throw error;
    }
  }

  /**
   * Rollback a post creation by deleting the post and all its data
   */
  private async rollbackPost(postId: string): Promise<void> {
    console.log('[Feed] Rolling back post:', postId);
    try {
      await firstValueFrom(this.postService.deletePost(postId));
      console.log('[Feed] Post rolled back successfully:', postId);
    } catch (rollbackError) {
      console.error('[Feed] Failed to rollback post:', rollbackError);
      // Log the error but don't throw - we've done our best to clean up
    }
  }

  /**
   * Save injected components to the database via RPC
   */
  private async saveComponents(
    postId: string,
    components: InjectedComponentData[]
  ): Promise<void> {
    console.log(
      `[Feed] Saving ${components.length} components for post ${postId}`
    );

    for (const component of components) {
      const dto: CreateSocialComponentDto = {
        postId,
        instanceId: component.instanceId,
        componentType: component.componentType,
        componentData: component.componentData,
        position: component.position || 0,
      };

      try {
        await firstValueFrom(
          this.http.post(`${this.gatewayUrl}/component`, dto)
        );
        console.log(
          `[Feed] Component saved: ${component.instanceId} (${component.componentType})`
        );
      } catch (error) {
        console.error(
          `[Feed] Failed to save component ${component.instanceId}:`,
          error
        );
        // Continue with other components even if one fails
      }
    }
    console.log('[Feed] All components saved');
  }

  ngOnDestroy() {
    const currentProfile = this.profileService.currentUserProfile();
    if (currentProfile) {
      // Unsubscribe from WebSocket topics
      this.socialWebSocketService.unsubscribeFromPosts(currentProfile.id);
      // Disconnect WebSocket
      this.socialWebSocketService.disconnect();
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  commented(newComment: CreateCommentDto, postIndex: number) {
    console.log('🚀 ~ FeedComponent ~ commented ~ newComment:', newComment);
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('Cannot comment: No current profile found.');
      return;
    }
    const posts = this.posts();
    newComment.postId = posts[postIndex].id;
    newComment.profileId = currentProfile.id;
    console.log(
      '🚀 ~ FeedComponent ~ commented ~ assigning profileId:',
      newComment.profileId
    );

    this.commentService.createComment(newComment).subscribe({
      next: (comment) => {
        console.log('Comment created successfully:', comment);
        // Immutable update to trigger change detection
        this.posts.update((currentPosts) => {
          const updatedPosts = [...currentPosts];
          const postIndex = updatedPosts.findIndex(
            (p) => p.id === newComment.postId
          );
          if (postIndex !== -1) {
            const post = { ...updatedPosts[postIndex] };
            post.comments = [...(post.comments || []), comment];
            updatedPosts[postIndex] = post;
            console.log(
              'Posts array updated immutably. Comments count:',
              post.comments.length
            );
          }
          return updatedPosts;
        });
      },
      error: (error) => {
        console.error('Error creating comment:', error);
      },
    });
  }

  canDeletePost(post: PostDto): boolean {
    const currentProfile = this.profileService.currentUserProfile();
    // Allow if current profile owns the post
    if (currentProfile && currentProfile.id === post.profileId) {
      return true;
    }
    // TODO: Add check for moderator/admin permissions if available
    return false;
  }

  onDeletePost(post: PostDto) {
    if (confirm('Are you sure you want to delete this post?')) {
      this.postService.deletePost(post.id).subscribe({
        next: () => {
          this.posts.update((posts) => posts.filter((p) => p.id !== post.id));
        },
        error: (err) => console.error('Failed to delete post', err),
      });
    }
  }

  canFollow(post: PostDto): boolean {
    const currentProfile = this.profileService.currentUserProfile();
    // Can follow if not self
    return !!currentProfile && currentProfile.id !== post.profileId;
  }

  isFollowing(post: PostDto): boolean {
    return this.followingIds.has(post.profileId);
  }

  onFollowToggle(post: PostDto) {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) return;

    const dto: FollowDto = {
      followerId: currentProfile.id,
      followeeId: post.profileId,
    };

    if (this.isFollowing(post)) {
      this.followService.unfollow(dto).subscribe({
        next: () => {
          this.followingIds.delete(post.profileId);
          // Re-sync follow state from the server to ensure UI stays consistent
          this.loadFollowing(currentProfile.id);
        },
        error: (err) => console.error('Failed to unfollow', err),
      });
    } else {
      this.followService.follow(dto).subscribe({
        next: () => {
          this.followingIds.add(post.profileId);
          // Re-sync follow state from the server to ensure UI reflects change
          this.loadFollowing(currentProfile.id);
        },
        error: (err) => console.error('Failed to follow', err),
      });
    }
  }

  onProfileClick(profileId: string) {
    if (profileId) {
      this.router.navigate(['/profile', profileId]);
    }
  }

  isBlocked(post: PostDto): boolean {
    return this.blockedIds.has(post.profileId);
  }

  onBlockToggle(post: PostDto) {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) return;

    if (this.isBlocked(post)) {
      this.profileService
        .unblockUser(currentProfile.id, post.profileId)
        .subscribe({
          next: () => {
            this.blockedIds.delete(post.profileId);
            console.log('User unblocked:', post.profileId);
          },
          error: (err: any) => console.error('Failed to unblock user', err),
        });
    } else {
      this.profileService
        .blockUser(currentProfile.id, post.profileId)
        .subscribe({
          next: () => {
            this.blockedIds.add(post.profileId);
            console.log('User blocked:', post.profileId);
          },
          error: (err: any) => console.error('Failed to block user', err),
        });
    }
  }

  onInviteToCommunity(event: { post: PostDto; communityId: string }) {
    const community = this.ownedCommunities().find(
      (c) => c.id === event.communityId
    );
    if (!community) return;

    this.communityService
      .inviteUser(event.communityId, event.post.profileId)
      .subscribe({
        next: () => {
          console.log('User invited to community:', community.name);
        },
        error: (err: any) =>
          console.error('Failed to invite user to community', err),
      });
  }

  onVoteChanged(event: { postId: string; value: number }) {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('Cannot vote: No current profile found.');
      return;
    }

    console.log('[Feed] Vote changed:', event);

    this.voteService
      .vote(event.postId, event.value, currentProfile.id)
      .subscribe({
        next: (vote) => {
          console.log('[Feed] Vote updated:', vote);
          // Update local vote state
          this.userVotes.update((votes) => ({
            ...votes,
            [event.postId]: event.value,
          }));
          // Update vote count
          this.voteCounts.update((counts) => {
            const currentCount = counts[event.postId] || 0;
            const currentVote = this.userVotes()[event.postId] || 0;
            let newCount = currentCount;
            if (currentVote === 0 && event.value !== 0) {
              newCount = currentCount + 1;
            } else if (currentVote !== 0 && event.value === 0) {
              newCount = Math.max(0, currentCount - 1);
            } else if (currentVote !== event.value) {
              // Vote changed, count stays the same
              newCount = currentCount;
            }
            return { ...counts, [event.postId]: newCount };
          });
        },
        error: (err) => console.error('[Feed] Failed to vote:', err),
      });
  }

  getUserVote(postId: string): number {
    return this.userVotes()[postId] || 0;
  }

  getVoteCount(postId: string): number {
    return this.voteCounts()[postId] || 0;
  }

  getUserReaction(postId: string): number {
    return this.userReactions()[postId] || 0;
  }

  getReactionCounts(postId: string): { [value: number]: number } {
    return this.reactionCounts()[postId] || {};
  }

  onReactionChanged(event: { postId: string; value: number }) {
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('Cannot react: No current profile found.');
      return;
    }

    console.log('[Feed] Reaction changed:', event);

    // Call the backend to add/update reaction
    this.reactionService
      .addReaction({
        postId: event.postId,
        value: event.value,
        profileId: currentProfile.id,
      })
      .subscribe({
        next: (reaction) => {
          console.log('[Feed] Reaction updated:', reaction);
          // Toggle reaction: if clicking same emoji, remove it; otherwise switch
          const currentReaction = this.userReactions()[event.postId] || 0;
          const newReaction = currentReaction === event.value ? 0 : event.value;

          this.userReactions.update((reactions) => ({
            ...reactions,
            [event.postId]: newReaction,
          }));

          // Update counts
          this.reactionCounts.update((counts) => {
            const postCounts = counts[event.postId] || {};
            const currentCount = postCounts[event.value] || 0;

            let newCounts = { ...postCounts };

            if (currentReaction === event.value) {
              // Removing this reaction
              newCounts[event.value] = Math.max(0, currentCount - 1);
            } else {
              // Adding or switching reaction
              if (currentReaction > 0) {
                // Remove old reaction
                newCounts[currentReaction] = Math.max(
                  0,
                  (postCounts[currentReaction] || 1) - 1
                );
              }
              newCounts[event.value] = currentCount + 1;
            }

            return { ...counts, [event.postId]: newCounts };
          });
        },
        error: (err) => console.error('[Feed] Failed to react:', err),
      });
  }

  getCurrentUserId(): string {
    const profile = this.profileService.currentUserProfile();
    // console.log('[Feed] Current profile:', profile);
    return profile?.id || '';
  }

  onScroll() {
    // const length = this.posts.length;
    // this.posts.push(...Array.from({ length: 20 }, (_, i) => `Post #${length + i + 1}`));
  }

  loadReactionData(posts: PostDto[]) {
    for (const post of posts) {
      this.reactionService
        .getReactionsByPost(post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe((reactions) => {
          this.reactionCounts.update((counts) => ({
            ...counts,
            [post.id]: reactions
              .map((r) => r.value)
              .reduce((acc, value) => {
                acc[value] = (acc[value] || 0) + 1;
                return acc;
              }, {} as { [value: number]: number }),
          }));
        });

      this.reactionService
        .getUserReaction(post.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe((reaction) => {
          this.userReactions.update((reactions) => ({
            ...reactions,
            [post.id]: reaction ? reaction.value : 0,
          }));
        });
    }
  }

  loadPublicFeed() {
    this.currentFeed = 'public';
    this.currentVisibility = 'public';
    this.currentPage = 0;
    this.hasMorePosts.set(true);
    this.postService
      .searchPosts(
        { visibility: 'public', communityId: null as any },
        {
          orderBy: 'createdAt',
          orderDirection: 'desc',
          limit: this.pageSize,
          offset: 0,
        }
      )
      .subscribe((posts: PostDto[]) => {
        this.posts.set(posts);
        this.hasMorePosts.set(posts.length >= this.pageSize);
        this.loadReactionData(posts);
        this.loadCommunityInfo(posts);
        this.loadProfiles(posts);
      });
  }

  loadFollowingFeed() {
    this.currentFeed = 'following';
    this.currentVisibility = 'following';
    this.currentPage = 0;
    this.hasMorePosts.set(true);
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }

    const loadPosts = () => {
      this.postService
        .getFeed({
          includeFollowing: true,
          includePublic: false,
          limit: this.pageSize,
          offset: 0,
        })
        .subscribe((posts: PostDto[]) => {
          const followingPosts = posts.filter(
            (post) =>
              this.followingIds.has(post.profileId) ||
              post.profileId === currentProfile.id
          );
          this.posts.set(followingPosts);
          this.hasMorePosts.set(followingPosts.length >= this.pageSize);
          this.loadReactionData(posts);
          this.loadCommunityInfo(posts);
          this.loadProfiles(posts);
        });
    };

    if (this.followingIds.size === 0) {
      this.loadFollowing(currentProfile.id);
      setTimeout(loadPosts, 100);
    } else {
      loadPosts();
    }
  }

  loadCommunitiesFeed() {
    this.currentFeed = 'communities';
    this.currentVisibility = 'communities';
    this.currentPage = 0;
    this.hasMorePosts.set(true);
    this.loading.set(true);

    this.communityService.getUserCommunities().subscribe({
      next: (communities) => {
        const communityIds = communities.map((c) => c.id);
        this.currentCommunityIds = communityIds;
        if (communityIds.length === 0) {
          this.posts.set([]);
          this.loading.set(false);
          return;
        }

        this.postService.getPostsByCommunityIds(communityIds).subscribe({
          next: (posts) => {
            this.posts.set(posts);
            this.hasMorePosts.set(posts.length >= this.pageSize);
            this.loadReactionData(posts);
            this.loadCommunityInfo(posts);
            this.loading.set(false);
            this.loadProfiles(posts);
          },
          error: (err) => {
            console.error('Failed to load community posts:', err);
            this.loading.set(false);
          },
        });
      },
      error: (err) => {
        console.error('Failed to load user communities:', err);
        this.loading.set(false);
      },
    });
  }

  loadMorePosts() {
    if (this.loadingMore() || !this.hasMorePosts()) {
      return;
    }

    this.loadingMore.set(true);
    this.currentPage++;

    const offset = this.currentPage * this.pageSize;

    if (this.currentVisibility === 'public') {
      this.postService
        .searchPosts(
          { visibility: 'public', communityId: null as any },
          {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: this.pageSize,
            offset,
          }
        )
        .subscribe({
          next: (posts) => {
            this.posts.update((current) => [...current, ...posts]);
            this.hasMorePosts.set(posts.length >= this.pageSize);
            this.loadReactionData(posts);
            this.loadCommunityInfo(posts);
            this.loadProfiles(posts);
            this.loadingMore.set(false);
          },
          error: () => {
            this.currentPage--;
            this.loadingMore.set(false);
          },
        });
    } else if (this.currentVisibility === 'following') {
      this.postService
        .getFeed({
          includeFollowing: true,
          includePublic: false,
          limit: this.pageSize,
          offset,
        })
        .subscribe({
          next: (posts) => {
            this.posts.update((current) => [...current, ...posts]);
            this.hasMorePosts.set(posts.length >= this.pageSize);
            this.loadReactionData(posts);
            this.loadCommunityInfo(posts);
            this.loadProfiles(posts);
            this.loadingMore.set(false);
          },
          error: () => {
            this.currentPage--;
            this.loadingMore.set(false);
          },
        });
    } else if (
      this.currentVisibility === 'communities' &&
      this.currentCommunityIds.length > 0
    ) {
      this.postService
        .getPostsByCommunityIds(this.currentCommunityIds)
        .subscribe({
          next: (posts) => {
            this.posts.update((current) => [...current, ...posts]);
            this.hasMorePosts.set(posts.length >= this.pageSize);
            this.loadReactionData(posts);
            this.loadCommunityInfo(posts);
            this.loadProfiles(posts);
            this.loadingMore.set(false);
          },
          error: () => {
            this.currentPage--;
            this.loadingMore.set(false);
          },
        });
    } else {
      this.loadingMore.set(false);
    }
  }

  private getFileExtensionFromDataUrl(
    dataUrl: string | null | undefined
  ): string {
    if (!dataUrl) return 'png';
    const mimeType = dataUrl.split(',')[0].match(/:(.*?);/)?.[1];
    const extensionMap: { [key: string]: string } = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };
    return extensionMap[mimeType || ''] || 'png';
  }
}
