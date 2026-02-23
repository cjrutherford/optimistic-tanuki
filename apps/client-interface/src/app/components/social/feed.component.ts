import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  signal,
  inject,
} from '@angular/core';

import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
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

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    ButtonComponent,
    SpinnerComponent,
    MatInputModule,
    MatIconModule,
    ComposeComponent,
    PostComponent,
  ],
  providers: [
    ThemeService,
    PostService,
    AttachmentService,
    CommentService,
    SocialWebSocketService,
    AssetService,
    FollowService,
  ],
  templateUrl: './feed.component.html',
  styleUrls: ['./feed.component.scss'],
})
export class FeedComponent implements OnInit, OnDestroy {
  posts = signal<PostDto[]>([]);
  loading = signal(true);
  followingIds = new Set<string>();
  themeStyles!: {
    backgroundColor: string;
    color: string;
    border: string;
  };
  destroy$ = new Subject<void>();

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

  onScroll() {
    // const length = this.posts.length;
    // this.posts.push(...Array.from({ length: 20 }, (_, i) => `Post #${length + i + 1}`));
  }

  loadPublicFeed() {
    this.currentFeed = 'public';
    this.postService
      .searchPosts({ visibility: 'public', communityId: null as any })
      .subscribe((posts: PostDto[]) => {
        this.posts.set(posts);
        this.loadProfiles(posts);
      });
  }

  loadFollowingFeed() {
    this.currentFeed = 'following';
    const currentProfile = this.profileService.currentUserProfile();
    if (!currentProfile) {
      console.error('No current profile found');
      return;
    }
    this.postService
      .getPosts({ visibility: 'followers', profileId: currentProfile.id })
      .subscribe((posts: PostDto[]) => {
        this.posts.set(posts);
        this.loadProfiles(posts);
      });
  }

  loadCommunitiesFeed() {
    this.currentFeed = 'communities';
    this.loading.set(true);

    this.communityService.getUserCommunities().subscribe({
      next: (communities) => {
        const communityIds = communities.map((c) => c.id);
        if (communityIds.length === 0) {
          this.posts.set([]);
          this.loading.set(false);
          return;
        }

        this.postService.getPostsByCommunityIds(communityIds).subscribe({
          next: (posts) => {
            this.posts.set(posts);
            this.loadProfiles(posts);
            this.loading.set(false);
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
